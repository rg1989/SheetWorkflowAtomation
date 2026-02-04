"""
Diff generation utilities.
"""
import pandas as pd
from typing import List, Dict, Any
from collections import defaultdict

from app.models.diff import (
    DiffResult,
    DiffSummary,
    RowChange,
    CellChange,
    ChangeType,
    Warning,
)


class DiffGenerator:
    """Generate visual diffs between original and modified DataFrames."""
    
    def generate(
        self,
        original_df: pd.DataFrame,
        modified_df: pd.DataFrame,
        changes: List[CellChange],
        key_column: str = None,
    ) -> DiffResult:
        """
        Generate a complete diff result.
        
        Args:
            original_df: Original target DataFrame
            modified_df: Modified target DataFrame
            changes: List of CellChange objects from engine
            key_column: Column used as key for matching
            
        Returns:
            DiffResult with full diff information
        """
        # Get key column from first change if not provided
        if not key_column and changes:
            # Try to infer from the data
            key_column = original_df.columns[0] if len(original_df.columns) > 0 else ""
        
        # Group changes by row
        changes_by_row: Dict[int, List[CellChange]] = defaultdict(list)
        for change in changes:
            changes_by_row[change.row].append(change)
        
        # Build row changes
        row_changes: List[RowChange] = []
        warnings: List[Warning] = []
        
        for row_idx, row_cell_changes in sorted(changes_by_row.items()):
            key_value = row_cell_changes[0].keyValue if row_cell_changes else ""
            
            # Check for warnings
            has_warning = False
            warning_message = None
            
            for cell_change in row_cell_changes:
                # Warning: value went negative
                if cell_change.newValue is not None:
                    try:
                        if float(cell_change.newValue) < 0:
                            has_warning = True
                            warning_message = f"Value became negative in column '{cell_change.column}'"
                            warnings.append(Warning(
                                type="negative_value",
                                message=warning_message,
                                row=row_idx,
                                column=cell_change.column,
                            ))
                    except (ValueError, TypeError):
                        pass
            
            row_changes.append(RowChange(
                rowIndex=row_idx,
                keyValue=key_value,
                cells=row_cell_changes,
                hasWarning=has_warning,
                warningMessage=warning_message,
            ))
        
        # Calculate summary
        rows_affected = len(changes_by_row)
        cells_modified = len(changes)
        total_rows = len(modified_df)
        warning_count = len(warnings)
        
        summary = DiffSummary(
            rowsAffected=rows_affected,
            cellsModified=cells_modified,
            totalRows=total_rows,
            warnings=warning_count,
            errors=0,
        )
        
        return DiffResult(
            summary=summary,
            changes=row_changes,
            warnings=warnings,
            columns=list(original_df.columns),
            keyColumn=key_column or "",
        )
    
    def compare_dataframes(
        self,
        original_df: pd.DataFrame,
        modified_df: pd.DataFrame,
        key_column: str,
    ) -> List[CellChange]:
        """
        Compare two DataFrames cell by cell and return all changes.
        Used for full comparison without engine-tracked changes.
        """
        changes: List[CellChange] = []
        
        for idx in range(len(original_df)):
            if idx >= len(modified_df):
                break
            
            key_value = str(original_df.iloc[idx].get(key_column, idx))
            
            for col in original_df.columns:
                if col not in modified_df.columns:
                    continue
                
                old_val = original_df.at[idx, col]
                new_val = modified_df.at[idx, col]
                
                # Check if values are different
                old_is_na = pd.isna(old_val)
                new_is_na = pd.isna(new_val)
                
                if old_is_na and new_is_na:
                    continue
                if old_is_na != new_is_na or old_val != new_val:
                    changes.append(CellChange(
                        row=idx,
                        column=col,
                        keyValue=key_value,
                        oldValue=None if old_is_na else old_val,
                        newValue=None if new_is_na else new_val,
                        changeType=ChangeType.MODIFIED,
                    ))
        
        return changes
