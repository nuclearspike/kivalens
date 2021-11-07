import React, {useCallback} from 'react'
import PT from 'prop-types'
import useStyles from 'isomorphic-style-loader/useStyles'
import {useSelector} from 'react-redux'
import Infinite from 'react-infinite'
import {ButtonGroup, Col, Container, Row} from '../bs'
import StickyColumn from '../Common/StickyColumn'
import ListItem from "../ListItem/ListItem"
import Criteria from './Criteria'
import Loan from '../Loan'
import LoansProgress from '../LoansProgress'
import s from './Search.css'
import li from '../ListItem/ListItem.css'
import BulkAddModal from './BulkAddModal'


const Search = ({selected_id, tab}) => {
  useStyles(s, li)
  const loan_ids = useSelector(({all_loans}) => all_loans)
  const loanLink = useCallback((id) => `/search/${id}/${tab}`, [tab])
  return (
    <Container fluid className={s.root}>
      <Row>
        <Col xs={12} md={3}>
          <ButtonGroup>
            <BulkAddModal loan_ids={loan_ids}/>
          </ButtonGroup>
          <StickyColumn>
            <LoansProgress/>
            <Infinite containerHeight={700} elementHeight={65}>
              {loan_ids.map((id) => <ListItem key={id} id={id} selected={id === selected_id} loanLink={loanLink}/>)}
            </Infinite>
          </StickyColumn>
        </Col>
        {selected_id ? (
          <Col xs={12} md={9}>
            <Loan id={selected_id}/>
          </Col>
        ) : (
          <Criteria/>
        )}
      </Row>
    </Container>
  )
}

Search.defaultProps = {
  tab: 'loan',
}

Search.propTypes = {
  selected_id: PT.number,
  tab: PT.string,
}

export default Search
