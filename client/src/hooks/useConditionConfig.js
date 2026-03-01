/**
 * Returns condition-specific extra fields for the DailyCheckin form.
 * Reads the saved condition from localStorage ('koru_condition').
 */
export default function useConditionConfig() {
  const condition = localStorage.getItem('koru_condition') || 'general';

  const configs = {
    general: {
      condition: 'general',
      label: 'General Health',
      fields: [],                 // no extra fields — uses default questionnaire
    },
    diabetes: {
      condition: 'diabetes',
      label: 'Diabetes',
      fields: [
        { key: 'glucose',     emoji: '🩸', label: 'Glucose (mg/dL)', type: 'number', placeholder: 'e.g. 120' },
        { key: 'insulin',     emoji: '💉', label: 'Insulin taken',   type: 'toggle' },
        { key: 'carbs',       emoji: '🍞', label: 'Carb intake',     type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'meal_type',   emoji: '🍽️', label: 'Last meal',       type: 'select', options: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
      ],
    },
    hypertension: {
      condition: 'hypertension',
      label: 'Hypertension',
      fields: [
        { key: 'bp',          emoji: '❤️‍🩹', label: 'Blood pressure', type: 'bp',     placeholder: '120/80' },
        { key: 'heart_rate',  emoji: '💓',  label: 'Heart rate (bpm)', type: 'number', placeholder: 'e.g. 72' },
        { key: 'sodium',      emoji: '🧂',  label: 'Sodium intake',    type: 'select', options: ['Low', 'Normal', 'High'] },
        { key: 'medication',  emoji: '💊',  label: 'Medication taken',  type: 'toggle' },
      ],
    },
  };

  return configs[condition] || configs.general;
}
