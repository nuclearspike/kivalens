import React from 'react'
import PropTypes from 'prop-types'
import {prettifyCamelCase} from '../../utils'

export const TitleField = ({title}) => (
  <legend>{prettifyCamelCase(title)}</legend>
)
TitleField.propTypes = {
  title: PropTypes.string,
}
TitleField.defaultProps = {
  title: '',
}
