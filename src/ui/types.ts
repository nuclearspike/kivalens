import type { ElementType, ComponentPropsWithoutRef, ReactNode } from 'react'

// Kept as string for parity with react-bootstrap's typing — variant
// values are sometimes computed at runtime (e.g. CriteriaTabs).
export type Variant = string

/** Props for polymorphic components supporting react-bootstrap's `as` prop. */
export type PolymorphicProps<T extends ElementType, ExtraProps = object> = {
  as?: T
  children?: ReactNode
} & ExtraProps &
  Omit<ComponentPropsWithoutRef<T>, keyof ExtraProps | 'as'>

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
