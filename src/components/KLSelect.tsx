import ReactSelect from 'react-select'
import type { GroupBase, Props } from 'react-select'

/**
 * react-select with a stable class prefix so main.scss can restyle it
 * to match the original app's react-select v1 rendering.
 */
export default function KLSelect<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(props: Props<Option, IsMulti, Group>) {
  return <ReactSelect classNamePrefix="Select" {...props} />
}
