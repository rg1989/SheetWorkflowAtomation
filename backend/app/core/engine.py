"""
Workflow execution engine.
"""
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from app.models.workflow import ConditionOperator, ActionType
from app.models.diff import CellChange, ChangeType


class WorkflowEngine:
    """Execute workflows on DataFrames."""
    
    def __init__(self, workflow_config: Dict[str, Any]):
        """
        Initialize the engine with a workflow configuration.
        
        Args:
            workflow_config: Full workflow config dict
        """
        self.config = workflow_config
        self.source_config = workflow_config.get("sourceConfig", {})
        self.key_column = self.source_config.get("keyColumn", "")
        self.steps = workflow_config.get("steps", [])
    
    def execute(
        self,
        source_df: pd.DataFrame,
        target_df: pd.DataFrame
    ) -> Tuple[List[CellChange], pd.DataFrame]:
        """
        Execute the workflow on source and target DataFrames.
        
        Args:
            source_df: Source data (e.g., sales data)
            target_df: Target data to modify (e.g., inventory)
            
        Returns:
            Tuple of (list of changes, modified target DataFrame)
        """
        # Create a copy of target to modify
        modified_df = target_df.copy()
        all_changes: List[CellChange] = []
        
        for step in self.steps:
            step_id = step.get("id", "")
            step_name = step.get("name", "")
            conditions = step.get("conditions", [])
            actions = step.get("actions", [])
            
            # Find matching rows in source
            matched_source_rows = self._apply_conditions(source_df, conditions)
            
            # For each matched source row, find corresponding target row and apply actions
            for source_idx in matched_source_rows:
                source_row = source_df.iloc[source_idx]
                key_value = source_row.get(self.key_column)
                
                if key_value is None or pd.isna(key_value):
                    continue
                
                # Find matching row in target
                target_mask = modified_df[self.key_column].astype(str) == str(key_value)
                target_indices = modified_df[target_mask].index.tolist()
                
                if not target_indices:
                    continue
                
                target_idx = target_indices[0]
                
                # Apply each action
                for action in actions:
                    changes = self._apply_action(
                        action=action,
                        source_row=source_row,
                        target_df=modified_df,
                        target_idx=target_idx,
                        key_value=str(key_value),
                        step_id=step_id,
                        step_name=step_name,
                    )
                    all_changes.extend(changes)
        
        return all_changes, modified_df
    
    def _apply_conditions(
        self,
        df: pd.DataFrame,
        conditions: List[Dict[str, Any]]
    ) -> List[int]:
        """
        Apply conditions to find matching row indices.
        All conditions are ANDed together.
        """
        if not conditions:
            # No conditions = match all rows
            return list(range(len(df)))
        
        mask = pd.Series([True] * len(df))
        
        for cond in conditions:
            column = cond.get("column", "")
            operator = cond.get("operator", "")
            value = cond.get("value")
            
            if column not in df.columns:
                continue
            
            col_data = df[column]
            
            if operator == ConditionOperator.EQUALS or operator == "equals":
                cond_mask = col_data.astype(str) == str(value)
            elif operator == ConditionOperator.NOT_EQUALS or operator == "notEquals":
                cond_mask = col_data.astype(str) != str(value)
            elif operator == ConditionOperator.CONTAINS or operator == "contains":
                cond_mask = col_data.astype(str).str.contains(str(value), case=False, na=False)
            elif operator == ConditionOperator.NOT_CONTAINS or operator == "notContains":
                cond_mask = ~col_data.astype(str).str.contains(str(value), case=False, na=False)
            elif operator == ConditionOperator.STARTS_WITH or operator == "startsWith":
                cond_mask = col_data.astype(str).str.startswith(str(value), na=False)
            elif operator == ConditionOperator.ENDS_WITH or operator == "endsWith":
                cond_mask = col_data.astype(str).str.endswith(str(value), na=False)
            elif operator == ConditionOperator.EXISTS or operator == "exists":
                cond_mask = col_data.notna() & (col_data.astype(str) != "")
            elif operator == ConditionOperator.IS_EMPTY or operator == "isEmpty":
                cond_mask = col_data.isna() | (col_data.astype(str) == "")
            elif operator == ConditionOperator.GREATER_THAN or operator == "greaterThan":
                cond_mask = pd.to_numeric(col_data, errors='coerce') > float(value)
            elif operator == ConditionOperator.LESS_THAN or operator == "lessThan":
                cond_mask = pd.to_numeric(col_data, errors='coerce') < float(value)
            elif operator == ConditionOperator.GREATER_THAN_OR_EQUAL or operator == "greaterThanOrEqual":
                cond_mask = pd.to_numeric(col_data, errors='coerce') >= float(value)
            elif operator == ConditionOperator.LESS_THAN_OR_EQUAL or operator == "lessThanOrEqual":
                cond_mask = pd.to_numeric(col_data, errors='coerce') <= float(value)
            else:
                cond_mask = pd.Series([True] * len(df))
            
            mask = mask & cond_mask
        
        return df[mask].index.tolist()
    
    def _apply_action(
        self,
        action: Dict[str, Any],
        source_row: pd.Series,
        target_df: pd.DataFrame,
        target_idx: int,
        key_value: str,
        step_id: str,
        step_name: str,
    ) -> List[CellChange]:
        """Apply a single action and return the changes made."""
        changes = []
        
        action_type = action.get("type", "")
        target_column = action.get("targetColumn", "")
        source_column = action.get("sourceColumn")
        value = action.get("value")
        
        if target_column not in target_df.columns:
            return changes
        
        old_value = target_df.at[target_idx, target_column]
        new_value = old_value
        
        if action_type == ActionType.SET_VALUE or action_type == "setValue":
            new_value = value
            
        elif action_type == ActionType.INCREMENT or action_type == "increment":
            try:
                current = float(old_value) if pd.notna(old_value) else 0
                increment = float(value) if value is not None else 0
                if source_column and source_column in source_row.index:
                    increment = float(source_row[source_column]) if pd.notna(source_row[source_column]) else 0
                new_value = current + increment
            except (ValueError, TypeError):
                new_value = old_value
                
        elif action_type == ActionType.DECREMENT or action_type == "decrement":
            try:
                current = float(old_value) if pd.notna(old_value) else 0
                decrement = float(value) if value is not None else 0
                if source_column and source_column in source_row.index:
                    decrement = float(source_row[source_column]) if pd.notna(source_row[source_column]) else 0
                new_value = current - decrement
            except (ValueError, TypeError):
                new_value = old_value
                
        elif action_type == ActionType.COPY_FROM or action_type == "copyFrom":
            if source_column and source_column in source_row.index:
                new_value = source_row[source_column]
                
        elif action_type == ActionType.CLEAR or action_type == "clear":
            new_value = None
            
        elif action_type == ActionType.FLAG or action_type == "flag":
            new_value = value if value else "FLAGGED"
        
        # Only record change if value actually changed
        if not self._values_equal(old_value, new_value):
            target_df.at[target_idx, target_column] = new_value
            
            changes.append(CellChange(
                row=int(target_idx),
                column=target_column,
                keyValue=key_value,
                oldValue=self._serialize_value(old_value),
                newValue=self._serialize_value(new_value),
                changeType=ChangeType.MODIFIED,
                stepId=step_id,
                stepName=step_name,
            ))
        
        return changes
    
    def _values_equal(self, v1: Any, v2: Any) -> bool:
        """Check if two values are equal, handling NaN/None."""
        if pd.isna(v1) and pd.isna(v2):
            return True
        if pd.isna(v1) or pd.isna(v2):
            return False
        return v1 == v2
    
    def _serialize_value(self, value: Any) -> Optional[Any]:
        """Serialize a value for JSON output."""
        if pd.isna(value):
            return None
        if isinstance(value, (int, float, str, bool)):
            return value
        return str(value)
