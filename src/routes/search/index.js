import React from 'react'
import Search from '../../components/Search'
import Layout from '../../components/Layout'

function action({params: {id: idString, tab}}) {
  if (idString && !tab) {
    return {
      redirect: `/search/${idString}/loan`,
    }
  }

  const id = idString ? parseInt(idString, 10) : null
  return {
    title: 'Find a loan',
    chunks: ['home'],
    component: (
      <Layout>
        <Search selected_id={id} tab={tab}/>
      </Layout>
    ),
  }
}

export default action
