"""
File upload and parsing API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends

from app.auth.deps import get_current_user
from app.db.models import UserDB
from app.core.parser import ExcelParser

router = APIRouter()


@router.post("/parse-columns")
async def parse_columns(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    header_row: int = Form(1),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Parse an Excel file and return its column names.
    Useful for workflow configuration.
    
    Args:
        file: The Excel file to parse
        sheet_name: Optional sheet name to parse. If not provided, parses the first sheet.
        header_row: Which row contains column headers (1-indexed for UX, default: 1 = first row)
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        parser = ExcelParser()
        
        # Get list of all sheets in the file
        available_sheets = parser.get_sheets(tmp_path)
        
        # Parse the specified sheet (or first sheet if not specified)
        # Convert header_row from 1-indexed (UX) to 0-indexed (pandas)
        df = parser.parse(tmp_path, sheet_name=sheet_name, header_row=header_row - 1)
        
        # Determine which sheet was actually parsed
        parsed_sheet = sheet_name if sheet_name else available_sheets[0] if available_sheets else None
        
        columns = []
        for col in df.columns:
            # Infer column type from data
            dtype = str(df[col].dtype)
            if 'int' in dtype or 'float' in dtype:
                col_type = 'number'
            elif 'datetime' in dtype:
                col_type = 'date'
            else:
                col_type = 'text'
            
            columns.append({
                "name": col,
                "type": col_type,
                "sampleValues": df[col].dropna().head(3).tolist(),
            })
        
        # Get sample data rows for preview
        sample_rows = df.head(5).to_dict('records')
        # Convert any NaN values to None for JSON serialization
        import math
        for row in sample_rows:
            for key, value in row.items():
                if isinstance(value, float) and math.isnan(value):
                    row[key] = None
        
        return {
            "filename": file.filename,
            "rowCount": len(df),
            "columns": columns,
            "sampleData": sample_rows,
            "sheetName": parsed_sheet,
            "availableSheets": available_sheets,
            "headerRow": header_row,
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
    
    finally:
        os.unlink(tmp_path)


@router.post("/validate")
async def validate_files(
    source_file: UploadFile = File(...),
    target_file: UploadFile = File(...),
    key_column: str = None,
    current_user: UserDB = Depends(get_current_user),
):
    """
    Validate that source and target files are compatible.
    Checks for matching key columns and data types.
    """
    # Save to temp files
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp1:
        content = await source_file.read()
        tmp1.write(content)
        source_path = tmp1.name
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp2:
        content = await target_file.read()
        tmp2.write(content)
        target_path = tmp2.name
    
    try:
        parser = ExcelParser()
        source_df = parser.parse(source_path)
        target_df = parser.parse(target_path)
        
        warnings = []
        errors = []
        
        # Check for key column
        if key_column:
            if key_column not in source_df.columns:
                errors.append(f"Key column '{key_column}' not found in source file")
            if key_column not in target_df.columns:
                errors.append(f"Key column '{key_column}' not found in target file")
        
        # Check for common columns
        source_cols = set(source_df.columns)
        target_cols = set(target_df.columns)
        common_cols = source_cols & target_cols
        
        if not common_cols:
            warnings.append("No common columns found between source and target files")
        
        # Check for matching keys
        if key_column and key_column in source_df.columns and key_column in target_df.columns:
            source_keys = set(source_df[key_column].dropna().astype(str))
            target_keys = set(target_df[key_column].dropna().astype(str))
            
            matching_keys = source_keys & target_keys
            unmatched_source = source_keys - target_keys
            
            if not matching_keys:
                errors.append("No matching keys found between source and target")
            if unmatched_source:
                warnings.append(f"{len(unmatched_source)} keys in source not found in target")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "sourceColumns": list(source_df.columns),
            "targetColumns": list(target_df.columns),
            "commonColumns": list(common_cols),
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error validating files: {str(e)}")
    
    finally:
        os.unlink(source_path)
        os.unlink(target_path)
