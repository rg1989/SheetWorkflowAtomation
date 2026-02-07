"""
Google Sheets API service.

Reads Google Sheets natively via Sheets API v4, converting
spreadsheet data to pandas DataFrames. More efficient than
Drive export for reading cell values.
"""
import asyncio
import logging
from typing import Optional

import pandas as pd
from googleapiclient.errors import HttpError

from app.services.drive import drive_retry, _handle_drive_error

logger = logging.getLogger("uvicorn.error")


@drive_retry
async def get_sheet_tabs(sheets_service, spreadsheet_id: str) -> list[dict]:
    """
    Get list of sheet tabs in a spreadsheet.

    Args:
        sheets_service: Google Sheets API service object
        spreadsheet_id: Spreadsheet ID

    Returns:
        list[dict]: List of sheet tab metadata (title, index, sheetId)

    Raises:
        HTTPException: On permission errors, file not found, or API errors
    """
    try:
        result = await asyncio.to_thread(
            lambda: sheets_service.spreadsheets().get(
                spreadsheetId=spreadsheet_id,
                fields="sheets.properties"
            ).execute()
        )

        tabs = [
            {
                "title": sheet["properties"]["title"],
                "index": sheet["properties"]["index"],
                "sheetId": sheet["properties"]["sheetId"]
            }
            for sheet in result.get("sheets", [])
        ]

        logger.info("Retrieved %d tabs from spreadsheet %s", len(tabs), spreadsheet_id)
        return tabs

    except HttpError as e:
        _handle_drive_error(e, spreadsheet_id)


@drive_retry
async def read_sheet_to_df(
    sheets_service,
    spreadsheet_id: str,
    range_name: str = ""
) -> pd.DataFrame:
    """
    Read Google Sheet to pandas DataFrame via Sheets API v4.

    Args:
        sheets_service: Google Sheets API service object
        spreadsheet_id: Spreadsheet ID
        range_name: A1 notation range (e.g., "Sheet1!A1:D10"). If empty, reads first sheet.

    Returns:
        pd.DataFrame: DataFrame with first row as column headers, stripped whitespace

    Raises:
        HTTPException: On permission errors, file not found, or API errors

    Notes:
        - Empty sheets return empty DataFrame
        - Header-only sheets return DataFrame with columns but no rows
        - Ragged rows are padded with None to match header length
    """
    try:
        # If no range specified, read the first sheet
        if not range_name:
            tabs = await get_sheet_tabs(sheets_service, spreadsheet_id)
            if not tabs:
                # No sheets in spreadsheet - return empty DataFrame
                logger.info("Spreadsheet %s has no sheets, returning empty DataFrame", spreadsheet_id)
                return pd.DataFrame()
            range_name = tabs[0]["title"]

        logger.info("Reading Google Sheet %s range=%s", spreadsheet_id, range_name)

        # Get sheet values
        result = await asyncio.to_thread(
            lambda: sheets_service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()
        )

        values = result.get("values", [])

        # Handle edge cases
        if not values:
            # No data at all
            logger.info("Sheet is empty, returning empty DataFrame")
            return pd.DataFrame()

        if len(values) == 1:
            # Only headers, no data rows
            headers = [str(col).strip() for col in values[0]]
            logger.info("Sheet has only headers (%d columns), no data rows", len(headers))
            return pd.DataFrame(columns=headers)

        # Normal case: headers + data rows
        headers = [str(col).strip() for col in values[0]]
        max_cols = len(headers)

        # Pad ragged rows with None to match header length
        padded_rows = [
            row + [None] * (max_cols - len(row))
            for row in values[1:]
        ]

        df = pd.DataFrame(padded_rows, columns=headers)
        logger.info("Read Google Sheet %s: %d rows, %d columns", spreadsheet_id, len(df), len(df.columns))
        return df

    except HttpError as e:
        _handle_drive_error(e, spreadsheet_id)
