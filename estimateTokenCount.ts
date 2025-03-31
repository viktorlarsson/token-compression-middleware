export const estimateTokenCount = (text: string): number => {
  const words = text.split(/\s+/);

  let tokenCount = 0;
  const punctuationRegex = /[\.,!?;:()\[\]{}"']/g;

  words.forEach((word) => {
    tokenCount += 1;

    const punctuationMatches = word.match(punctuationRegex);
    if (punctuationMatches) {
      tokenCount += punctuationMatches.length;
    }
  });

  return tokenCount;
};
