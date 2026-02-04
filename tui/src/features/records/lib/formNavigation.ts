/**
 * Form Navigation (Task 3.3)
 *
 * Handles Tab/Shift+Tab field navigation in forms
 */

/**
 * Navigation state
 */
export interface FormNavigationState {
  fields: string[];
  currentIndex: number;
  currentField: string | null;
}

/**
 * Create initial navigation state
 */
export function createFormNavigation(fields: string[]): FormNavigationState {
  if (fields.length === 0) {
    return {
      fields,
      currentIndex: -1,
      currentField: null,
    };
  }

  return {
    fields,
    currentIndex: 0,
    currentField: fields[0],
  };
}

/**
 * Navigate to next field (Tab)
 */
export function navigateNext(state: FormNavigationState): FormNavigationState {
  if (state.fields.length === 0) {
    return state;
  }

  const nextIndex = (state.currentIndex + 1) % state.fields.length;

  return {
    ...state,
    currentIndex: nextIndex,
    currentField: state.fields[nextIndex],
  };
}

/**
 * Navigate to previous field (Shift+Tab)
 */
export function navigatePrev(state: FormNavigationState): FormNavigationState {
  if (state.fields.length === 0) {
    return state;
  }

  const prevIndex =
    state.currentIndex <= 0
      ? state.fields.length - 1
      : state.currentIndex - 1;

  return {
    ...state,
    currentIndex: prevIndex,
    currentField: state.fields[prevIndex],
  };
}

/**
 * Navigate to specific field by name
 */
export function navigateToField(
  state: FormNavigationState,
  fieldName: string
): FormNavigationState {
  const index = state.fields.indexOf(fieldName);

  if (index === -1) {
    return state;
  }

  return {
    ...state,
    currentIndex: index,
    currentField: fieldName,
  };
}

/**
 * Navigation direction type
 */
export type NavigationDirection = "next" | "previous";

/**
 * Simple field navigation helper
 *
 * @param currentIndex Current focused field index
 * @param totalFields Total number of fields
 * @param direction Navigation direction
 * @returns New field index
 */
export function navigateField(
  currentIndex: number,
  totalFields: number,
  direction: NavigationDirection
): number {
  if (totalFields === 0) {
    return -1;
  }

  if (totalFields === 1) {
    return 0;
  }

  if (direction === "next") {
    return (currentIndex + 1) % totalFields;
  } else {
    return currentIndex <= 0 ? totalFields - 1 : currentIndex - 1;
  }
}
