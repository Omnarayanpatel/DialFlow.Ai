const getAnalyticsSummary = async () => {
  return {
    totalCalls: 0,
    connectedCalls: 0,
    conversionRate: 0,
  };
};

module.exports = {
  getAnalyticsSummary,
};
