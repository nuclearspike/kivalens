import React from 'react'
import Layout from '../../components/Layout'
import Options from '../../components/Options'

const action = () => {
  return {
    title: 'Options',
    chunks: ['home'],
    component: (
      <Layout>
        <Options/>
      </Layout>
    ),
  }
}

export default action
