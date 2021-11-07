import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import {TitleField} from './Common'
import PaneledObjectFieldTemplate from './ObjectFieldTemplate'
import {criteriaSchema, uiCriteriaSchema} from './allOptions'


const defaultFields = {
  TitleField,
}

const widgets = {}

const CriteriaForm = () => {
  return (
    <Form
      schema={criteriaSchema}
      uiSchema={uiCriteriaSchema}
      fields={defaultFields}
      widgets={widgets}
      formData={{loan: {sectors: {aan: 'none', value: ['Donkey']}}}}
      ObjectFieldTemplate={PaneledObjectFieldTemplate}
    >
      &nbsp;
    </Form>
  )
}

export default CriteriaForm
