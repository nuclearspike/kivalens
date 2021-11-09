import useStyles from 'isomorphic-style-loader/useStyles'
import React from 'react'
import PropTypes from 'prop-types'
import s from './Home.css'

const Home = ({news}) => {
  useStyles(s)
  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>React.js News</h1>
        {news.map(item => (
          <article key={item.link} className={s.newsItem}>
            <h1 className={s.newsTitle}>
              <a href={item.link}>{item.title}</a>
            </h1>
            <div
              className={s.newsDesc}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{__html: item.content}}
            />
          </article>
        ))}
      </div>
    </div>
  )
}

export default Home

Home.propTypes = {
  news: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
      content: PropTypes.string,
    }),
  ).isRequired,
}
