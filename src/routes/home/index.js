import React from 'react'

async function action({ fetch }) {
  return {
    redirect: '/search',
  }

  // const resp = await fetch('/graphql', {
  //   body: JSON.stringify({
  //     query: '{news{title,link,content}}',
  //   }),
  // });
  // const { data } = await resp.json();
  // if (!data || !data.news) throw new Error('Failed to load the news feed.');
  // return {
  //   title: 'React Starter Kit',
  //   chunks: ['home'],
  //   component: (
  //     <Layout>
  //       <Home news={data.news} />
  //     </Layout>
  //   ),
  // };
}

export default action;
