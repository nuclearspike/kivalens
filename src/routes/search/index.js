import React from 'react';
import Search from '../../components/Search';
import Layout from '../../components/Layout';

function action({ params: { id: idString } }) {
  const id = idString ? parseInt(idString, 10) : null;
  return {
    title: 'Find a loan',
    chunks: ['home'],
    component: (
      <Layout>
        <Search selectedId={id} />
      </Layout>
    ),
  };
}

export default action;
