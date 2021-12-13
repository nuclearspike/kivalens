import React from 'react';
import Layout from '../../components/Layout';
import About from '../../components/About';

function action() {
  return {
    chunks: ['about'],
    title: 'About',
    component: (
      <Layout>
        <About />
      </Layout>
    ),
  };
}

export default action;
