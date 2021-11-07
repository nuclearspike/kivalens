import React from 'react'
import Layout from '../../components/Layout'
import Basket from '../../components/Basket'

function action({params: {id: idString, tab}}) {
  if (idString && !tab) {
    return {
      redirect: `/basket/${idString}/loan`,
    }
  }

  const id = idString ? parseInt(idString, 10) : null
  return {
    title: 'Basket',
    chunks: ['home'],
    component: (
      <Layout>
        <Basket selected_id={id} tab={tab}/>
      </Layout>
    ),
  }
}

export default action
