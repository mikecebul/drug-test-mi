/**
 * Calculate string similarity score (0-1) using Levenshtein distance
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  if (s1 === s2) return 1

  const len1 = s1.length
  const len2 = s2.length
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen
}

/**
 * Calculate weighted name similarity with separate scoring for first and last names
 * Prioritizes last name matches (60% weight) over first name matches (40% weight)
 *
 * @param searchFirst - First name from search
 * @param searchLast - Last name from search
 * @param clientFirst - Client's first name
 * @param clientLast - Client's last name
 * @param searchMiddle - Optional middle initial from search
 * @param clientMiddle - Optional client's middle initial
 * @returns Weighted similarity score (0-1)
 */
export function calculateNameSimilarity(
  searchFirst: string,
  searchLast: string,
  clientFirst: string,
  clientLast: string,
  searchMiddle?: string,
  clientMiddle?: string,
): number {
  // Calculate individual component similarities
  const lastNameScore = calculateSimilarity(searchLast, clientLast)
  const firstNameScore = calculateSimilarity(searchFirst, clientFirst)

  // Calculate middle initial similarity if both are provided
  let middleScore = 1 // Default to 1 if no middle name to compare
  if (searchMiddle && clientMiddle) {
    middleScore = calculateSimilarity(searchMiddle, clientMiddle)
  } else if (searchMiddle || clientMiddle) {
    // If only one has a middle initial, don't penalize heavily
    middleScore = 0.8
  }

  // Weighted average: Last name is most important (60%), first name (30%), middle (10%)
  const weightedScore = (
    lastNameScore * 0.6 +
    firstNameScore * 0.3 +
    middleScore * 0.1
  )

  return weightedScore
}
