// Utility for category gradient styles and colors

export const categoryGradients = {
  performance: "bg-gradient-to-r from-blue-500 to-purple-600",
  growth: "bg-gradient-to-r from-green-500 to-teal-600", 
  efficiency: "bg-gradient-to-r from-orange-500 to-red-600",
  retention: "bg-gradient-to-r from-purple-500 to-pink-600",
  competitive: "bg-gradient-to-r from-indigo-500 to-blue-600",
  // Add common analysis_type values that might exist in the database
  financial: "bg-gradient-to-r from-emerald-500 to-cyan-600",
  marketing: "bg-gradient-to-r from-rose-500 to-orange-600",
  operational: "bg-gradient-to-r from-violet-500 to-purple-600",
  operations: "bg-gradient-to-r from-slate-500 to-gray-600",
  sales: "bg-gradient-to-r from-amber-500 to-yellow-600",
  default: "bg-gradient-to-r from-red-500 to-yellow-600"
} as const;

export const getCategoryGradient = (category: string): string => {
  const key = category.toLowerCase();
  const gradient = categoryGradients[key as keyof typeof categoryGradients];
  
  // Debug logging to see what categories we're getting
  if (!gradient) {
    console.log(`No gradient found for category: "${category}" (key: "${key}")`);
  }
  
  return gradient || categoryGradients.default;
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