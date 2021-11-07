import React from 'react'
import HoverOver from '../Common/HoverOver'
import {Form} from '../bs'

const StringCriteriaField = ({schema, formData, onChange}) => {
  const handleOnChange = ({target: {value}}) => onChange(value)
  return (
    <>
      <HoverOver title={schema.title} description={schema.description}/>
      <Form.Control
        onChange={handleOnChange}
        value={formData}
        placeholder={schema.placeholder}
      />
    </>
  )
}

export default StringCriteriaField
