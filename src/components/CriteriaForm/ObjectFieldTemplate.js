import React from 'react'
import PropTypes from 'prop-types'
import Card from 'react-bootstrap/Card'
import {mapArray, prettifyCamelCase} from '../../utils'
// import s from './ObjectFieldTemplate.css'
// export default withStyles(s)(ObjectTemplate)

const ObjectFieldTemplate = ({title, description, schema, properties}) => {
  return (
    <Card>
      {!schema.hide_title && (
        <Card.Header>{prettifyCamelCase(title)}</Card.Header>
      )}
      <Card.Body>
        <div style={{fontSize: 14, marginLeft: 4}}>{description}</div>
        {mapArray(properties, (element, index) => (
          <div key={index}>{element.content}</div>
        ))}
      </Card.Body>
    </Card>
  )
}
ObjectFieldTemplate.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  properties: PropTypes.arrayOf(
    PropTypes.shape({
      content: PropTypes.node,
    }),
  ),
  schema: PropTypes.shape({
    title_field: PropTypes.string,
    additionalProperties: PropTypes.bool,
  }),
  formData: PropTypes.object,
};

export default ObjectFieldTemplate
