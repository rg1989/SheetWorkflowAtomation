"""
Excel file parsing utilities.
"""
import pandas as pd
from typing import List, Dict, Any, Optional
import openpyxl


class ExcelParser:
    """Parse Excel files into DataFrames."""
    
    def parse(self, file_path: str, sheet_name: Optional[str] = None, header_row: int = 0) -> pd.DataFrame:
        """
        Parse an Excel file and return a DataFrame.
        
        Args:
            file_path: Path to the Excel file
            sheet_name: Specific sheet to parse (default: first sheet)
            header_row: Which row to use as column headers (0-indexed, default: 0 = first row)
            
        Returns:
            pandas DataFrame with the file contents
        """
        try:
            df = pd.read_excel(
                file_path,
                sheet_name=sheet_name or 0,
                header=header_row,
                engine='openpyxl'
            )

            # Normalize column names to strings and strip whitespace
            # Handle cases where columns might be integers, floats, or tuples
            new_columns = []
            for col in df.columns:
                if isinstance(col, str):
                    new_columns.append(col.strip())
                else:
                    # Convert non-string columns to string (e.g., int, float, tuple)
                    new_columns.append(str(col).strip())
            df.columns = new_columns

            return df

        except Exception as e:
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
    
    def get_sheets(self, file_path: str) -> List[str]:
        """Get list of sheet names in an Excel file."""
        try:
            wb = openpyxl.load_workbook(file_path, read_only=True)
            return wb.sheetnames
        except Exception as e:
            raise ValueError(f"Failed to read Excel file: {str(e)}")
    
    def infer_schema(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Infer column types from a DataFrame.
        
        Returns list of column info dicts with name, type, and sample values.
        """
        columns = []
        
        for col in df.columns:
            dtype = str(df[col].dtype)
            
            if 'int' in dtype:
                col_type = 'integer'
            elif 'float' in dtype:
                col_type = 'number'
            elif 'datetime' in dtype:
                col_type = 'date'
            elif 'bool' in dtype:
                col_type = 'boolean'
            else:
                col_type = 'text'
            
            # Get sample values (non-null)
            samples = df[col].dropna().head(3).tolist()
            
            columns.append({
                "name": str(col),
                "type": col_type,
                "sampleValues": samples,
                "nullCount": int(df[col].isna().sum()),
                "uniqueCount": int(df[col].nunique()),
            })
        
        return columns
