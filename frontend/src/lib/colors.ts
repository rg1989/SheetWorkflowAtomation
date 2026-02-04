/**
 * Color system for multi-file merge workflows.
 * Each file gets assigned a unique color for visual distinction.
 */

export interface FileColor {
  name: string
  // Tailwind class names
  bg: string
  bgLight: string
  border: string
  borderLight: string
  text: string
  textDark: string
  ring: string
  // Hex values for inline styles
  hex: string
  hexLight: string
}

/**
 * 5 predefined colors for files (up to 5 files supported)
 */
export const FILE_COLORS: FileColor[] = [
  {
    name: 'blue',
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-50',
    border: 'border-blue-500',
    borderLight: 'border-blue-200',
    text: 'text-blue-600',
    textDark: 'text-blue-700',
    ring: 'ring-blue-500',
    hex: '#3B82F6',
    hexLight: '#EFF6FF',
  },
  {
    name: 'emerald',
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-500',
    borderLight: 'border-emerald-200',
    text: 'text-emerald-600',
    textDark: 'text-emerald-700',
    ring: 'ring-emerald-500',
    hex: '#10B981',
    hexLight: '#ECFDF5',
  },
  {
    name: 'amber',
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    border: 'border-amber-500',
    borderLight: 'border-amber-200',
    text: 'text-amber-600',
    textDark: 'text-amber-700',
    ring: 'ring-amber-500',
    hex: '#F59E0B',
    hexLight: '#FFFBEB',
  },
  {
    name: 'purple',
    bg: 'bg-purple-500',
    bgLight: 'bg-purple-50',
    border: 'border-purple-500',
    borderLight: 'border-purple-200',
    text: 'text-purple-600',
    textDark: 'text-purple-700',
    ring: 'ring-purple-500',
    hex: '#8B5CF6',
    hexLight: '#FAF5FF',
  },
  {
    name: 'rose',
    bg: 'bg-rose-500',
    bgLight: 'bg-rose-50',
    border: 'border-rose-500',
    borderLight: 'border-rose-200',
    text: 'text-rose-600',
    textDark: 'text-rose-700',
    ring: 'ring-rose-500',
    hex: '#F43F5E',
    hexLight: '#FFF1F2',
  },
]

/**
 * Get color for a file by its index (0-4)
 */
export function getFileColor(colorIndex: number): FileColor {
  return FILE_COLORS[colorIndex % FILE_COLORS.length]
}

/**
 * Get the next available color index for a new file
 */
export function getNextColorIndex(usedIndices: number[]): number {
  for (let i = 0; i < FILE_COLORS.length; i++) {
    if (!usedIndices.includes(i)) {
      return i
    }
  }
  // If all colors used, cycle back
  return usedIndices.length % FILE_COLORS.length
}

/**
 * Maximum number of files allowed
 */
export const MAX_FILES = 5
