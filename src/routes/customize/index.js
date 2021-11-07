import React from 'react'
import CustomizeForm from '../../components/CriteriaForm/CustomizeCriteriaForm'
import Layout from '../../components/Layout'

function action() {
  return {
    title: 'Find a loan',
    chunks: ['home'],
    component: (
      <Layout>
        <CustomizeForm/>
      </Layout>
    ),
  }
}

export default action
