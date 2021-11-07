import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import {TitleField} from './Common'
import {Toggle} from '@fluentui/react'
import {Col, Container, Row} from '../bs'
import {criteriaSchema} from './allOptions'
import CollapsingObjectFieldTemplate from './CollapsingObjectFieldTemplate'
import useStyles from 'isomorphic-style-loader/useStyles'
import GroupEnabledContext from './GroupEnabledContext'
import s from './CustomizeCriteriaForm.scss'

const defaultFields = {
  TitleField,
}

const widgets = {}

const DataAsTitleField = ({formData}) => (
  <legend>{formData}</legend>
)

const DataAsDescription = ({formData}) => (
  <div style={{fontSize: 14}}>{formData}</div>
)

const ToggleField = ({schema, formData, onChange}) => {
  return (
    <GroupEnabledContext.Consumer>
      {({enabled}) => (
        <Toggle
          label="Enabled"
          onText="Visible"
          offText="Hidden"
          checked={formData}
          disabled={schema.level === 2 ? !enabled : false}
          onChange={(_, checked) => onChange(checked)}
        />
      )}
    </GroupEnabledContext.Consumer>
  )
}

const customizeSchema = {
  title: '',
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
      },
      enabled: {
        title: '',
        default: true,
        type: 'boolean',
      },
      name: {
        type: 'string',
      },
      entries: {
        type: 'array',
        title: ' ',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
            },
            enabled: {
              title: '',
              default: true,
              type: 'boolean',
            },
            description: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
          },
        },
      },
    },
  },
}

const customizeUiSchema = {
  items: {
    // 'ui:field': CollapsingObjectFieldTemplate,
    name: {
      'ui:widget': 'hidden',
    },
    title: {
      'ui:widget': 'hidden',
    },
    enabled: {
      'ui:field': ToggleField,
    },
    entries: {
      'ui:options': {
        addable: false,
        removable: false,
      },
      items: {
        name: {
          'ui:widget': 'hidden',
        },
        title: {
          'ui:widget': 'hidden',
        },
        description: {
          'ui:field': DataAsDescription,
        },
        enabled: {
          'ui:field': ToggleField,
        },
      },
    },
  },
  'ui:options': {
    addable: false,
    removable: false,
  },
}

function genCustomizeData(s) {
  const groups = []
  Object.keys(s.properties).forEach((key) => {
    const def = s.properties[key]
    const entries = []
    Object.keys(def.properties).forEach((key) => {
      entries.push({
        name: key,
        title: def.properties[key].title,
        description: def.properties[key].description,
        enabled: true,
        level: 2,
      })
    })
    groups.push({
      name: key,
      title: def.title,
      enabled: true,
      entries,
      level: 1,
    })
  })
  return groups
}

const data = genCustomizeData(criteriaSchema)


const CustomizeCriteriaForm = () => {
  useStyles(s)
  return (
    <Container className={s.root}>
      <Row>
        <Col>
          <h1>Customize Your Searches</h1>
          <h5>
            Hide criteria you never use, order them the way you want.
          </h5>
          <Form
            schema={customizeSchema}
            uiSchema={customizeUiSchema}
            fields={defaultFields}
            widgets={widgets}
            formData={data}
            ObjectFieldTemplate={CollapsingObjectFieldTemplate}
          >
            &nbsp;
          </Form>
        </Col>
      </Row>
    </Container>
  )
}

export default CustomizeCriteriaForm
