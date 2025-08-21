// Utility for category gradient styles and colors

export const categoryGradients = {
  performance: "bg-gradient-to-r from-blue-500 to-purple-600",
  growth: "bg-gradient-to-r from-green-500 to-teal-600", 
  efficiency: "bg-gradient-to-r from-orange-500 to-red-600",
  retention: "bg-gradient-to-r from-purple-500 to-pink-600",
  competitive: "bg-gradient-to-r from-indigo-500 to-blue-600"
} as const;

export const getCategoryGradient = (category: string): string => {
  const key = category.toLowerCase();
  return categoryGradients[key as keyof typeof categoryGradients] || "bg-gradient-to-r from-gray-500 to-gray-600";
};

export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    performance: 'Performance Analysis',
    growth: 'Growth Opportunities', 
    efficiency: 'Operational Efficiency',
    retention: 'Customer Retention',
    competitive: 'Competitive Analysis'
  };
  return labels[category.toLowerCase()] || category;
};