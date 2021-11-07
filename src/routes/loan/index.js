import React from 'react'
import Layout from '../../components/Layout'
import Loan from "../../components/Loan"

async function action({params: {id: idString, tab}}) {
  const id = parseInt(idString, 10)
  return {
    chunks: ['loan'],
    component: (
      <Layout>
        <Loan id={id} tab={tab}/>
      </Layout>
    ),
  }
}

export default action
