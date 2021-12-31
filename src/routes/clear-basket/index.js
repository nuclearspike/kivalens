import React from 'react';
import Layout from '../../components/Layout';
import ClearBasket from '../../components/ClearBasket/ClearBasket';

function action() {
  return {
    title: 'Please wait for basket to clear',
    chunks: ['clear-basket'],
    component: (
      <Layout>
        <ClearBasket />
      </Layout>
    ),
  };
}

export default action;
