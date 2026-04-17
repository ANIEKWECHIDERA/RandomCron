export interface TruncatedText {
  value: string;
  truncated: boolean;
  originalLength: number;
}

export function truncateText(value: string, maxLength: number): TruncatedText {
  if (value.length <= maxLength) {
    return {
      value,
      truncated: false,
      originalLength: value.length,
    };
  }

  return {
    value: `${value.slice(0, maxLength)}\n[truncated ${value.length - maxLength} characters]`,
    truncated: true,
    originalLength: value.length,
  };
}
