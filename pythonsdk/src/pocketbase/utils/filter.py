"""Filter utility for building PocketBase filter expressions."""

from datetime import datetime
from typing import Any


def build_filter(expression: str, params: dict[str, Any] | None = None) -> str:
    """Build a filter expression with parameter substitution.
    
    Replaces {:param} placeholders with properly formatted values.
    
    Args:
        expression: The filter expression with placeholders.
        params: Dictionary of parameter values.
        
    Returns:
        The filter expression with substituted values.
        
    Examples:
        >>> build_filter("status = {:status}", {"status": True})
        "status = true"
        >>> build_filter("created > {:date}", {"date": datetime.now()})
        "created > '2024-01-01 00:00:00.000Z'"
    """
    if not params:
        return expression

    result = expression

    for key, value in params.items():
        placeholder = "{:" + key + "}"
        formatted_value = _format_value(value)
        result = result.replace(placeholder, formatted_value)

    return result


def _format_value(value: Any) -> str:
    """Format a value for use in a filter expression.
    
    Args:
        value: The value to format.
        
    Returns:
        Formatted string representation of the value.
    """
    if value is None:
        return "null"
    
    if isinstance(value, bool):
        return "true" if value else "false"
    
    if isinstance(value, (int, float)):
        return str(value)
    
    if isinstance(value, datetime):
        # Format as PocketBase datetime string
        return f"'{value.strftime('%Y-%m-%d %H:%M:%S')}.000Z'"
    
    if isinstance(value, str):
        # Escape single quotes in strings
        escaped = value.replace("'", "\\'")
        return f"'{escaped}'"
    
    if isinstance(value, (list, tuple)):
        # Format as array
        formatted_items = [_format_value(item) for item in value]
        return f"[{', '.join(formatted_items)}]"
    
    # Default: convert to string and quote
    return f"'{value}'"
