import React from 'react';
import Layout from '../../components/Layout';
import Basket from '../../components/Basket';

function action({ params: { id: idString } }) {
  const id = idString ? parseInt(idString, 10) : null;
  return {
    title: 'Basket',
    chunks: ['home'],
    component: (
      <Layout>
        <Basket selectedId={id} />
      </Layout>
    ),
  };
}

export default action;
