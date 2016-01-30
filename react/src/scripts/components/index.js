'use strict'
//every component you want easily accessible should be added as an import and export in this file.
//this allow you to do: import {Loan, Live, KivaImage, KivaLink} from '.' (the '.' just means the index.js in the current directory.)

//PAGES
import Search from './Search.jsx'
import Criteria from './Criteria.jsx'
import Loan from './Loan.jsx'
import Basket from './Basket.jsx'
import Options from './Options.jsx'
import About from './About.jsx'
import SnowStack from './SnowStack.jsx'
import Live from './Live.jsx'
import Teams from './Teams.jsx'
import ClearBasket from './ClearBasket.jsx'
import Outdated from './Outdated.jsx'

const NotFound = () => <h1>Not Found</h1>

//SIMPLE STATE-LESS COMPONENTS
import React from 'react'

const ClickLink = ({onClick,children}) => <a href="#" onClick={e=>{e.preventDefault(); onClick(e)}}>{children}</a>
const NewTabLink = ({href, title, children}) => <a href={href} onClick={e=>rga.outboundLink({label: href},c=>{})} title={title || 'Open link in new tab'} target="_blank">{children}</a>
const KivaLink = ({path, title, children}) => <NewTabLink href={`https://www.kiva.org/${path}`} title={title || 'Open page on www.kiva.org in new tab'}>{children}</NewTabLink>
const LenderLink = ({lender, title, children}) => <KivaLink path={`lender/${lender}?super_graphs=1`} title={title || "View Lender's page in a new tab"}>{children}</KivaLink>
const LoanLink = ({id, title, children, loan}) => {
    if (loan){
        id = loan.id
        title = `View loan for ${loan.name} on Kiva.org in a new tab`
    }
    return <KivaLink path={`lend/${id}`} title={title || 'View Loan in a new tab'}>{children}</KivaLink>
}
const EmailLink = ({email, subject, body, title, children}) => {
    var params = []
    if (subject) params.push(`subject=${encodeURI(subject)}`)
    if (body) params.push(`body=${encodeURI(body)}`)
    return <NewTabLink href={`mailto:${email? email: 'liquidmonkey@gmail.com'}?${params.join('&')}`} title={title || 'Open your default email program'}>{children}</NewTabLink>
}
const KLALink = ({children = <span>Kiva Lender Assistant Chrome Extension</span>}) => {
    return <NewTabLink href="https://chrome.google.com/webstore/detail/kiva-lender-assistant/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US" title="Go to Google Chrome WebStore">{children}</NewTabLink>
}
//COMPONENTS
import KLNav from './KLNav.jsx'
import KLFooter from './KLFooter.jsx'
import LoanListItem from './LoanListItem.jsx'
import BasketListItem from './BasketListItem.jsx'
import LoadingLoansPanel from './LoadingLoansPanel.jsx'
import BulkAddModal from './BulkAddModal.jsx'
import KivaImage from './KivaImage.jsx'
import ChartDistribution from './ChartDistribution.jsx'
import CriteriaTabs from './CriteriaTabs.jsx'
import CycleChild from './CycleChild.jsx'
import PromptModal from './PromptModal.jsx'
import SetLenderIDModal from './SetLenderIDModal.jsx'
import PartnerDisplayModal from './PartnerDisplayModal.jsx'
import AlertModal from './AlertModal.jsx'
import AutoLendSettings from './AutoLendSettings.jsx'

export {NewTabLink, KLALink, KivaLink, LenderLink, LoanLink, EmailLink, ClickLink,
    Search, Loan, NotFound, About, Basket, Options, Criteria, KivaImage, Live, Teams,
    KLNav, KLFooter, LoadingLoansPanel, BulkAddModal, LoanListItem, BasketListItem,
    ChartDistribution, CriteriaTabs, ClearBasket, CycleChild, PromptModal,
    SetLenderIDModal, SnowStack, PartnerDisplayModal, AlertModal,
    AutoLendSettings, Outdated}