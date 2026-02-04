"""
Merge workflow execution engine.
Merges multiple files into a single output based on defined column sources.
"""
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from app.models.merge_workflow import (
    MergeWorkflow,
    OutputColumn,
    ColumnSource,
    DirectColumnSource,
    ConcatColumnSource,
    MathColumnSource,
    CustomColumnSource,
    KeyColumnConfig,
)


class MergeEngine:
    """Execute merge workflows on multiple DataFrames."""
    
    def __init__(self, workflow_config: Dict[str, Any]):
        """
        Initialize the engine with a merge workflow configuration.
        
        Args:
            workflow_config: Full merge workflow config dict
        """
        self.config = workflow_config
        self.files_config = workflow_config.get("files", [])
        self.key_column_config = workflow_config.get("keyColumn")
        self.output_columns = workflow_config.get("outputColumns", [])
        
        # Build file ID to config mapping
        self.file_map = {f["id"]: f for f in self.files_config}
    
    def execute(
        self,
        dataframes: Dict[str, pd.DataFrame]
    ) -> Tuple[pd.DataFrame, List[str]]:
        """
        Execute the merge workflow on multiple DataFrames.
        
        Args:
            dataframes: Dict mapping file IDs to their DataFrames
            
        Returns:
            Tuple of (merged output DataFrame, list of warnings)
        """
        warnings: List[str] = []
        
        if not self.output_columns:
            warnings.append("No output columns defined")
            return pd.DataFrame(), warnings
        
        # Sort output columns by order
        sorted_columns = sorted(self.output_columns, key=lambda c: c.get("order", 0))
        
        # Determine the base rows
        # If key column is set, merge on that; otherwise use first file's rows
        if self.key_column_config:
            # Key column config has a "mappings" dict: fileId -> column name for each file
            key_mappings = self.key_column_config.get("mappings", {})
            
            if not key_mappings:
                warnings.append("No key column mappings defined")
                return pd.DataFrame(), warnings
            
            # Use the first file as the base for key values
            first_file_id = self.files_config[0]["id"] if self.files_config else None
            if not first_file_id or first_file_id not in dataframes:
                warnings.append("First file not found in provided dataframes")
                return pd.DataFrame(), warnings
            
            base_key_column = key_mappings.get(first_file_id)
            if not base_key_column:
                warnings.append(f"No key column mapping for first file")
                return pd.DataFrame(), warnings
            
            base_df = dataframes[first_file_id]
            if base_key_column not in base_df.columns:
                warnings.append(f"Key column '{base_key_column}' not found in base file. Available: {list(base_df.columns)}")
                return pd.DataFrame(), warnings
            
            # Get unique key values from the first file
            key_values = base_df[base_key_column].dropna().unique().tolist()
        else:
            # Use first file as base
            first_file_id = self.files_config[0]["id"] if self.files_config else None
            if first_file_id and first_file_id in dataframes:
                base_df = dataframes[first_file_id]
                key_values = list(range(len(base_df)))
            else:
                warnings.append("No files available for merge")
                return pd.DataFrame(), warnings
        
        # Build the output DataFrame
        output_data: Dict[str, List[Any]] = {col["name"]: [] for col in sorted_columns}
        
        # Track unmatched keys per file for summary warning
        unmatched_keys_by_file: Dict[str, List[str]] = {file_id: [] for file_id in dataframes.keys()}
        
        # Process each row
        for idx, key_value in enumerate(key_values):
            # Get matching row data from each file
            file_rows: Dict[str, Optional[pd.Series]] = {}
            
            if self.key_column_config:
                key_mappings = self.key_column_config.get("mappings", {})
                for file_id, df in dataframes.items():
                    # Get the key column name for this specific file
                    file_key_col = key_mappings.get(file_id)
                    
                    if file_key_col and file_key_col in df.columns:
                        # Match by key value using this file's key column
                        matching_rows = df[df[file_key_col].astype(str) == str(key_value)]
                        if len(matching_rows) > 0:
                            file_rows[file_id] = matching_rows.iloc[0]
                        else:
                            file_rows[file_id] = None
                            # Track unmatched key for this file
                            if len(unmatched_keys_by_file[file_id]) < 10:  # Limit to first 10
                                unmatched_keys_by_file[file_id].append(str(key_value))
                    else:
                        # No key column for this file, try to match by index
                        if idx < len(df):
                            file_rows[file_id] = df.iloc[idx]
                        else:
                            file_rows[file_id] = None
            else:
                # Match by index
                for file_id, df in dataframes.items():
                    if idx < len(df):
                        file_rows[file_id] = df.iloc[idx]
                    else:
                        file_rows[file_id] = None
            
            # Process each output column
            for col_config in sorted_columns:
                col_name = col_config["name"]
                source = col_config.get("source", {})
                value = self._compute_column_value(source, file_rows, warnings)
                output_data[col_name].append(value)
        
        # Create output DataFrame
        output_df = pd.DataFrame(output_data)
        
        # Add summary warnings for unmatched keys
        for file_id, unmatched_keys in unmatched_keys_by_file.items():
            if unmatched_keys:
                file_name = self.file_map.get(file_id, {}).get("name", file_id)
                sample_keys = ", ".join(unmatched_keys[:5])
                if len(unmatched_keys) > 5:
                    sample_keys += f" (and {len(unmatched_keys) - 5} more...)"
                warnings.append(
                    f"'{file_name}' had {len(unmatched_keys)}+ keys with no match: {sample_keys}"
                )
        
        return output_df, warnings
    
    def _compute_column_value(
        self,
        source: Dict[str, Any],
        file_rows: Dict[str, Optional[pd.Series]],
        warnings: List[str]
    ) -> Any:
        """
        Compute the value for a single cell based on the column source configuration.
        """
        source_type = source.get("type", "custom")
        
        if source_type == "direct":
            return self._compute_direct(source, file_rows)
        elif source_type == "concat":
            return self._compute_concat(source, file_rows)
        elif source_type == "math":
            return self._compute_math(source, file_rows, warnings)
        elif source_type == "custom":
            return source.get("defaultValue", "")
        else:
            return None
    
    def _compute_direct(
        self,
        source: Dict[str, Any],
        file_rows: Dict[str, Optional[pd.Series]]
    ) -> Any:
        """Get value directly from a column."""
        file_id = source.get("fileId")
        column = source.get("column")
        
        if not file_id or not column:
            return None
        
        row = file_rows.get(file_id)
        if row is None:
            return None
        
        if column in row.index:
            value = row[column]
            if pd.isna(value):
                return None
            return value
        return None
    
    def _compute_concat(
        self,
        source: Dict[str, Any],
        file_rows: Dict[str, Optional[pd.Series]]
    ) -> str:
        """Concatenate multiple parts into a string."""
        parts = source.get("parts", [])
        separator = source.get("separator", "")
        
        result_parts = []
        for part in parts:
            part_type = part.get("type")
            
            if part_type == "literal":
                result_parts.append(str(part.get("value", "")))
            elif part_type == "column":
                file_id = part.get("fileId")
                column = part.get("column")
                
                if file_id and column:
                    row = file_rows.get(file_id)
                    if row is not None and column in row.index:
                        value = row[column]
                        if not pd.isna(value):
                            result_parts.append(str(value))
                        else:
                            result_parts.append("")
                    else:
                        result_parts.append("")
                else:
                    result_parts.append("")
        
        return separator.join(result_parts)
    
    def _compute_math(
        self,
        source: Dict[str, Any],
        file_rows: Dict[str, Optional[pd.Series]],
        warnings: List[str]
    ) -> Optional[float]:
        """Perform a math operation on operands."""
        operation = source.get("operation", "add")
        operands = source.get("operands", [])
        
        if not operands:
            return None
        
        values: List[float] = []
        for operand in operands:
            operand_type = operand.get("type")
            
            if operand_type == "literal":
                val = operand.get("value")
                if val is not None:
                    try:
                        values.append(float(val))
                    except (ValueError, TypeError):
                        values.append(0.0)
            elif operand_type == "column":
                file_id = operand.get("fileId")
                column = operand.get("column")
                
                if file_id and column:
                    row = file_rows.get(file_id)
                    if row is not None:
                        if column in row.index:
                            cell_value = row[column]
                            if pd.notna(cell_value):
                                try:
                                    values.append(float(cell_value))
                                except (ValueError, TypeError):
                                    # Non-numeric value, treat as 0
                                    values.append(0.0)
                            else:
                                # NaN value
                                values.append(0.0)
                        else:
                            # Column not found in row - this might be the issue
                            # Let's be more flexible with column matching (strip whitespace)
                            found = False
                            for col in row.index:
                                if str(col).strip() == str(column).strip():
                                    cell_value = row[col]
                                    if pd.notna(cell_value):
                                        try:
                                            values.append(float(cell_value))
                                            found = True
                                            break
                                        except (ValueError, TypeError):
                                            values.append(0.0)
                                            found = True
                                            break
                            if not found:
                                values.append(0.0)
                    else:
                        # No row data for this file (no matching key)
                        values.append(0.0)
                else:
                    values.append(0.0)
        
        if not values:
            return None
        
        # Perform the operation
        try:
            if operation == "add":
                return sum(values)
            elif operation == "subtract":
                result = values[0]
                for v in values[1:]:
                    result -= v
                return result
            elif operation == "multiply":
                result = 1.0
                for v in values:
                    result *= v
                return result
            elif operation == "divide":
                result = values[0]
                for v in values[1:]:
                    if v == 0:
                        warnings.append("Division by zero encountered")
                        return None
                    result /= v
                return result
            else:
                return None
        except Exception as e:
            warnings.append(f"Math error: {str(e)}")
            return None
    
    def preview(
        self,
        dataframes: Dict[str, pd.DataFrame],
        max_rows: int = 10
    ) -> Tuple[pd.DataFrame, List[str]]:
        """
        Generate a preview of the merge result.
        
        Args:
            dataframes: Dict mapping file IDs to their DataFrames
            max_rows: Maximum number of rows to include in preview
            
        Returns:
            Tuple of (preview DataFrame, list of warnings)
        """
        output_df, warnings = self.execute(dataframes)
        
        # Limit rows for preview
        if len(output_df) > max_rows:
            output_df = output_df.head(max_rows)
            warnings.append(f"Preview limited to {max_rows} rows")
        
        return output_df, warnings


def execute_merge_workflow(
    workflow_config: Dict[str, Any],
    dataframes: Dict[str, pd.DataFrame]
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Convenience function to execute a merge workflow.
    
    Args:
        workflow_config: The merge workflow configuration
        dataframes: Dict mapping file IDs to their DataFrames
        
    Returns:
        Tuple of (output DataFrame, list of warnings)
    """
    engine = MergeEngine(workflow_config)
    return engine.execute(dataframes)
