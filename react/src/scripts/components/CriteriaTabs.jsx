'use strict'

import React from 'react'
import {Link} from 'react-router'
import Select from 'react-select'
import Slider from 'react-slider' // 'multi-slider' is incompatible with .14 presently
import Reflux from 'reflux'
import numeral from 'numeral'
import cx from 'classnames'
import a from '../actions'
import {LinkedComplexCursorMixin,DelayStateTriggerMixin} from './Mixins'
import s from '../stores/'
import {Grid,Row,Col,Input,Button,DropdownButton,MenuItem,Tabs,Tab,Panel,OverlayTrigger,Popover,Alert} from 'react-bootstrap'
import {Cursor, ImmutableOptimizations} from 'react-cursor'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import {ClickLink, KivaLink, NewTabLink, PartnerDisplayModal, AutoLendSettings} from '.'
import TimeAgo from 'react-timeago'
import {defaultKivaData} from '../api/kiva'
import extend from 'extend'
var Highcharts = require('react-highcharts/bundle/ReactHighcharts')

var allOptions = {}

//borrower selects
allOptions.country_code = {label: 'Countries', allAnyNone: true, multi: true, select_options: defaultKivaData.countries.select(n=>({"label":n.name,"value":n.code}))}
allOptions.sector = {label: 'Sectors', allAnyNone: true, multi: true, select_options: defaultKivaData.sectors.select(n=>({"label":n,"value":n}))}
allOptions.activity = {label: 'Activities', allAnyNone: true, multi: true, select_options: ["Agriculture","Air Conditioning","Animal Sales","Arts","Auto Repair","Bakery","Balut-Making","Barber Shop","Beauty Salon","Bicycle Repair","Bicycle Sales","Blacksmith","Bookbinding","Bookstore","Bricks","Butcher Shop","Cafe","Call Center","Carpentry","Catering","Cattle","Cement","Cereals","Charcoal Sales","Cheese Making","Child Care","Cloth & Dressmaking Supplies","Clothing","Clothing Sales","Cobbler","Computers","Construction","Construction Supplies","Consumer Goods","Cosmetics Sales","Crafts","Dairy","Decorations Sales","Dental","Education provider","Electrical Goods","Electrician","Electronics Repair","Electronics Sales","Embroidery","Entertainment","Farm Supplies","Farming","Film","Fish Selling","Fishing","Flowers","Food","Food Market","Food Production/Sales","Food Stall","Fruits & Vegetables","Fuel/Firewood","Funeral Expenses","Furniture Making","Games","General Store","Goods Distribution","Grocery Store","Hardware","Health","Higher education costs","Home Appliances","Home Energy","Home Products Sales","Hotel","Internet Cafe","Jewelry","Knitting","Land Rental","Laundry","Liquor Store / Off-License","Livestock","Machine Shop","Machinery Rental","Manufacturing","Medical Clinic","Metal Shop","Milk Sales","Mobile Phones","Motorcycle Repair","Motorcycle Transport","Movie Tapes & DVDs","Music Discs & Tapes","Musical Instruments","Musical Performance","Natural Medicines","Office Supplies","Paper Sales","Party Supplies","Patchwork","Perfumes","Personal Housing Expenses","Personal Medical Expenses","Personal Products Sales","Personal Purchases","Pharmacy","Phone Accessories","Phone Repair","Phone Use Sales","Photography","Pigs","Plastics Sales","Poultry","Primary/secondary school costs","Printing","Property","Pub","Quarrying","Recycled Materials","Recycling","Religious Articles","Renewable Energy Products","Restaurant","Retail","Rickshaw","Secretarial Services","Services","Sewing","Shoe Sales","Soft Drinks","Souvenir Sales","Spare Parts","Sporting Good Sales","Tailoring","Taxi","Textiles","Timber Sales","Tourism","Transportation","Traveling Sales","Upholstery","Used Clothing","Used Shoes","Utilities","Vehicle","Vehicle Repairs","Veterinary Sales","Waste Management","Water Distribution","Weaving","Wedding Expenses","Well digging","Wholesale"].select(n=>({"label":n,"value":n}))}
allOptions.tags = {label: 'Tags', canAll: true, allAnyNone: true, multi: true, select_options: [{"value":"user_favorite","label":"User Favorite"},{"value":"volunteer_like","label":"Volunteer Like"},{"value":"volunteer_pick","label":"Volunteer Pick"},{"value":"#Animals","label":"#Animals"},{value: "#BizDurableAsset", label:"#BizDurableAsset"},{"value":"#Eco-friendly","label":"#Eco-friendly"},{"value":"#Elderly","label":"#Elderly"},{"value":"#Fabrics","label":"#Fabrics"},{"value":"#FemaleEducation","label":"#FemaleEducation"},{"value":"#FirstLoan","label":"#FirstLoan"},{"value":"#HealthandSanitation","label":"#HealthAndSanitation"},{"value":"#IncomeProducingDurableAsset","label":"#IncomeProducingDurableAsset (no longer used)"},{"value":"#InspiringStory","label":"#InspiringStory (no longer used)"},{"value":"#InterestingPhoto","label":"#InterestingPhoto (no longer used)"},{"value":"#JobCreator","label":"#JobCreator"},{"value":"#Low-profitFP","label":"#Low-profitFP (no longer used)"},{"value":"#Orphan","label":"#Orphan"},{"value":"#Parent","label":"#Parent"},{"value":"#Refugee","label":"#Refugee"},{value: "#RepairRenewReplace", label: "#RepairRenewReplace"},{"value":"#RepeatBorrower","label":"#RepeatBorrower"},{"value":"#Schooling","label":"#Schooling"},{"value":"#Single","label":"#Single"},{"value":"#SingleParent","label":"#SingleParent"},{"value":"#SupportingFamily","label":"#SupportingFamily"},{"value":"#SustainableAg","label":"#SustainableAg"},{"value":"#Technology","label":"#Technology"},{"value":"#Trees","label":"#Trees"},{"value":"#Unique","label":"#Unique (no longer used)"},{"value":"#Vegan","label":"#Vegan"},{"value":"#Widowed","label":"#Widowed"},{"value":"#WomanOwnedBiz","label":"#WomanOwnedBiz"}]}
allOptions.themes = {label: 'Themes', canAll: true, allAnyNone: true, multi: true, select_options: ["Arab Youth","Conflict Zones","Disaster recovery","Fair Trade","Flexible Credit Study","Green","Growing Businesses","Health","Higher Education","Innovative Loans","Islamic Finance","Job Creation","Kiva City Detroit","Kiva City LA","Mobile Technology","Rural Exclusion","SME","Start-Up","Underfunded Areas","Vulnerable Groups","Water and Sanitation","Youth"].select(n=>({"label":n,"value":n}))}
allOptions.currency_exchange_loss_liability = {label: "Currency Loss", multi: true, select_options:[{value:'shared', label:"Shared Loss"},{value:'none', label:"No Currency Exchange Loss"},{value:'partner', label:'Partner covers'}]}
allOptions.bonus_credit_eligibility = {label: "Bonus Credit", multi: false, select_options:[{value: '', label:"Show All"}, {value:'true', label:"Only loans eligible"},{value:'false', label:"Only loans NOT eligible"}]}
allOptions.repayment_interval = {label: "Repayment Interval", multi: true, select_options:[{value:'Monthly', label:"Monthly"},{value:"Irregularly", label:"Irregularly"},{value:"At end of term", label:"At end of term"}]}
allOptions.sort = {label: 'Sort', multi: false, select_options: [{value: null, label: "Final repayment date (default)"},{"value": "half_back", label: "Date half is paid back, then 75%, then full"},{value:'newest',label:'Newest'},{value:'expiring',label:'Expiring'},{value:'popularity',label:'Popularity ($/hour)'},{value: 'still_needed', label: "$ Still Needed"}]}

//face detection
allOptions.vision_face_joy = {label: 'Face: Joy', allAnyNone: true, multi: true, select_options: [{"value":"POSSIBLE","label":"Possible"},{"value":"LIKELY","label":"Likely"},{"value":"VERY_LIKELY","label":"Very likely"}]}
allOptions.vision_face_sorrow = {label: 'Face: Sorrow', allAnyNone: true, multi: true, select_options: [{"value":"POSSIBLE","label":"Possible"},{"value":"LIKELY","label":"Likely"},{"value":"VERY_LIKELY","label":"Very likely"}]}
allOptions.vision_face_anger = {label: 'Face: Anger', allAnyNone: true, multi: true, select_options: [{"value":"POSSIBLE","label":"Possible"},{"value":"LIKELY","label":"Likely"},{"value":"VERY_LIKELY","label":"Very likely"}]}
allOptions.vision_face_surprise = {label: 'Face: Surprise', allAnyNone: true, multi: true, select_options: [{"value":"POSSIBLE","label":"Possible"},{"value":"LIKELY","label":"Likely"},{"value":"VERY_LIKELY","label":"Very likely"}]}
allOptions.vision_face_headwear = {label: 'Face: Headwear', allAnyNone: true, multi: true, select_options: [{"value":"POSSIBLE","label":"Possible"},{"value":"LIKELY","label":"Likely"},{"value":"VERY_LIKELY","label":"Very likely"}]}

//partner selects
allOptions.direct = {label: 'MFI or Direct',  multi: false, select_options: [{"value":'',"label":"MFI Only (default)"},{"value":'direct',"label":"Direct Only (Ignores all criteria options below)"}]}
allOptions.social_performance = {label: 'Social Performance', allAnyNone: true, canAll: true, multi: true, intArray:true, select_options: [{"value":'1',"label":"Anti-Poverty Focus"},{"value":'3',"label":"Client Voice"},{"value":'5',"label":"Entrepreneurial Support"},{"value":'6',"label":"Facilitation of Savings"},{"value":'4',"label":"Family and Community Empowerment"},{"value":'7',"label":"Innovation"},{"value":'2',"label":"Vulnerable Group Focus"}]}
allOptions.region = {label: 'Region', allAnyNone: true, multi: true, select_options: [{"value":"na","label":"North America"},{"value":"ca","label":"Central America"},{"value":"sa","label":"South America"},{"value":"af","label":"Africa"},{"value":"as","label":"Asia"},{"value":"me","label":"Middle East"},{"value":"ee","label":"Eastern Europe"},{"value":"oc","label":"Oceania"},{"value":"we","label":"Western Europe"}]} //{"value":"an","label":"Antarctica"},
allOptions.partners = {label: "Partners", allAnyNone: true, multi: true, intArray:true, select_options: []}
allOptions.charges_fees_and_interest = {label: "Charges Interest",  multi: false, select_options:[{value: '', label:"Show All"}, {value:'true', label:"Only partners that charge fees & interest"},{value:'false', label:"Only partners that do NOT charge fees & interest"}]}

//portfolio selects
allOptions.exclude_portfolio_loans = {label: "Exclude My Loans", multi: false, select_options:[{value:'true', label:"Yes, Exclude Loans I've Made"},{value:'false', label:"No, Include Loans I've Made"}]} //,{value:"only", label:"Only Show My Fundraising Loans"}

//balancing
allOptions.pb_partner  = {label: "Partners", key: 'id', slice_by: 'partner'}
allOptions.pb_country  = {label: "Countries", slice_by: 'country'}
allOptions.pb_region   = {label: "Regions", slice_by: 'region'} //not used.
allOptions.pb_sector   = {label: "Sectors", slice_by: 'sector'}
allOptions.pb_activity = {label: "Activites", slice_by: 'activity'}

//loan sliders
allOptions.repaid_in = {min: 2, max: 90, label: 'Repaid In (months)', helpText: "The number of months between today and the final scheduled repayment. Kiva's sort by repayment terms, which is how many months the borrower has to pay back, creates sorting and filtering issues due to when the loan was posted and the disbursal date. KivaLens just looks at the final scheduled repayment date relative to today."}
allOptions.borrower_count = {min: 1, max: 20, label: 'Borrower Count', helpText: "The number of borrowers included in the loan. To see only individual loans, set the max to 1. To see only group loans, set the min to 2 and the max at the far right."}
allOptions.percent_female = {min: 0, max: 100, label: 'Percent Female', helpText: "What percentage of the borrowers are female. For individual borrowers, the loan will either be 0% or 100%. On Kiva, a group is considered 'Female' if more than half of the members are women. So you can set the lower bound to 50% and the upper to 100% to mimic that behavior. Additionally, you could look for groups that are 100% female, or set the lower to 40% and upper to 60% to find groups that are about evenly mixed."}
allOptions.age = {min: 19, max: 100, label: 'Age Mentioned', helpText: "KivaLens looks for variations of the pattern '20-99 year(s) old' in the description and uses the first one mentioned... which may be the age of the borrower's parent or child. Read the description to double-check it! More than half of the loans have ages that can be pulled out, but many cannot. You must set the lower slider to something other than 'min' or loans with no ages found will be included as well."}
allOptions.still_needed = {min: 0, max: 1000, step: 25, label: 'Still Needed ($)', helpText: "How much is still needed to fully fund the loan. Loan Amount - Funded Amount - Basket Amount. Set the lower bound to $25 to exclude loans that are fully funded with basket amounts. Set both the lower and upper bound to $25 to find loans where they just need one more lender."} //min: 25? otherwise it bounces back to 25 if set to min
allOptions.loan_amount = {min: 0, max: 10000, step: 25, label: 'Loan Amount ($)', helpText: "How much is the loan for? Smaller loans are given to poorer people, so this can help you to focus on either large loans from established borrowers or smaller loans."}
allOptions.dollars_per_hour = {min: 0, max: 500, label: '$/Hour', helpText: "Funded Amounts + Basket Amounts / Time since posting. Find the fastest funding loans."}
allOptions.percent_funded = {min: 0, max: 100, step: 1, label: 'Funded (%)', helpText: "What percent of the loan has already been funded (includes amounts in baskets)"}
allOptions.expiring_in_days = {min: 0, max: 35, label: 'Expiring In (days)', helpText: "The number of days left before the loan expires if not funded."}
allOptions.disbursal_in_days = {min: -90, max: 90, label: 'Disbursal (days)', helpText: "Relative to today, when does the borrower get the money? Negative days mean the borrower already has the money and the Kiva loan is used to back-fill the loan from the MFI rather than making the borrower wait for fundraising. Positive days mean the borrower does not yet have the money."}

//partner sliders
allOptions.partner_risk_rating = {min: 0, max: 5, step: 0.5, label: 'Risk Rating (stars)', helpText: "5 star means that Kiva has estimated that the institution servicing the loan has very low probability of collapse. 1 star means they may be new and untested. To include unrated partners, have the left-most slider all the way at left."}
allOptions.partner_arrears = {min: 0, max: 50, step: 0.1, label: 'Delinq Rate (%)', helpText: "Kiva defines the Delinquency (Arrears) Rate as the amount of late payments divided by the total outstanding principal balance Kiva has with the Field Partner. Arrears can result from late repayments from Kiva borrowers as well as delayed payments from the Field Partner.  How this is calculated: Delinquency (Arrears) Rate = Amount of Paying Back Loans Delinquent / Amount Outstanding"}
allOptions.partner_default = {min: 0, max: 30, step: 0.1, label: 'Default Rate (%)', helpText: "The default rate is the percentage of ended loans (no longer paying back) which have failed to repay (measured in dollar volume, not units). How this is calculated: Default Rate = Amount of Ended Loans Defaulted / Amount of Ended Loans. For more information, please refer to Kiva's Help Center. "}
allOptions.portfolio_yield = {min: 0, max: 100, step: 0.1, label: 'Portfolio Yield (%)', helpText: "Although Kiva and its lenders don't charge interest or fees to borrowers, many of Kiva's Field Partners do charge borrowers in some form in order to make possible the long-term sustainability of their operations, reach and impact. See Kiva for more information on Portfolio Yield."}
allOptions.profit = {min: -100, max: 100, step: 0.1, label: 'Profit (%)', helpText: "'Return on Assets' is an indication of a Field Partner's profitability. It can also be an indicator of the long-term sustainability of an organization, as organizations consistently operating at a loss (those that have a negative return on assets) may not be able to sustain their operations over time."}
allOptions.loans_at_risk_rate = {min: 0, max: 100, label: 'Loans at Risk (%)', helpText: "The loans at risk rate refers to the percentage of Kiva loans being paid back by this Field Partner that are past due in repayment by at least 1 day. This delinquency can be due to either non-payment by Kiva borrowers or non-payment by the Field Partner itself. Loans at Risk Rate = Amount of paying back loans that are past due / Total amount of Kiva loans outstanding"}
allOptions.currency_exchange_loss_rate = {min: 0, max: 10, step: 0.1, label: 'Currency Exchange Loss (%)', helpText: "Kiva calculates the Currency Exchange Loss Rate for its Field Partners as: Amount of Currency Exchange Loss / Total Loans."}
allOptions.average_loan_size_percent_per_capita_income = {min: 0, max: 300, label: 'Average Loan/Capita Income', helpText: "The Field Partner's average loan size is expressed as a percentage of the country's gross national annual income per capita. Loans that are smaller (that is, as a lower percentage of gross national income per capita) are generally made to more economically disadvantaged populations. However, these same loans are generally more costly for the Field Partner to originate, disburse and collect."}
allOptions.years_on_kiva = {min: 0, max: 12, step: 0.25, label: 'Years on Kiva', helpText: "How long the partners has been posting loans on Kiva."}
allOptions.loans_posted = {min: 0, max: 20000, step: 50, label: 'Loans Posted', helpText: "How many loans the partner has posted to Kiva."}
allOptions.secular_rating = {min: 1, max: 4, label: 'Secular Score (Atheist List)', helpText: "4 Completely secular, 3 Secular but with some religious influence (e.g. a secular MFI that partners with someone like World Vision), or it appears secular but with some uncertainty, 2 Nonsecular but loans without regard to borrower’s beliefs, 1 Nonsecular with a religious agenda."}
allOptions.social_rating = {min: 1, max: 4, label: 'Social Score (Atheist List)', helpText: "4 Excellent social initiatives - proactive social programs and efforts outside of lending. Truly outstanding social activities. 3 Good social initiatives in most areas. MFI has some formal and structured social programs. 2 Social goals but no/few initiatives (may have savings, business counseling). 1 No attention to social goals or initiatives. Typically the MFI only focuses on their own business issues (profitability etc.). They might mention social goals but it seems to be there just because it’s the right thing to say (politically correct)."}

//<DropSelectButton value={value} options={[{value:'',label:''}]} defaultValue={value} onChange={this.blah}/>
const DropSelectButton = React.createClass({
    getInitialState(){return {value: this.props.value}},
    onSelect(selected){
        this.setState({value:selected})
        this.props.onChange(selected)
    },
    componentWillReceiveProps({value}){
        this.setState({value: value})
    },
    render(){
        let {options, defaultValue, style = {}} = this.props
        var value = this.state.value
        var oSel = options.first(o=>o.value == value)
        oSel = oSel || options.first(o=>o.value == defaultValue) || {}
        extend(true, style, {padding:'4px',marginRight:'2px',marginLeft:'2px'})
        return <DropdownButton bsStyle="primary" style={style} title={oSel.buttonDisplay || oSel.label} id="bg-nested-dropdown">
            <For each="option" index="i" of={options}>
                <MenuItem key={i} onClick={this.onSelect.bind(this,option.value)} eventKey={i}>{option.label}</MenuItem>
            </For>
        </DropdownButton>
    }
})

const AllAnyNoneButton = React.createClass({
    mixins: [ImmutableOptimizations(['cursor'])],
    onSelect(selected){
        this.props.cursor.set(selected)
    },
    render(){
        let {canAll} = this.props
        var selected = this.props.cursor.value || (canAll ? 'all' : 'any')
        var styles = (canAll)? {'all':'success','any':'primary','none':'danger'} :{'any':'success','none':'danger'}
        return <DropdownButton style={{height:'34px',padding:'8px',width:'53px'}} title={selected} bsStyle={styles[selected]} id="bg-nested-dropdown">
            <If condition={canAll}>
                <MenuItem onClick={this.onSelect.bind(this,'all')} eventKey="1">All of these</MenuItem>
            </If>
            <MenuItem onClick={this.onSelect.bind(this,'any')} eventKey="2">Any of these</MenuItem>
            <MenuItem onClick={this.onSelect.bind(this,'none')} eventKey="3">None of these</MenuItem>
        </DropdownButton>
    }
})

const InputRow = React.createClass({
    mixins: [ImmutableOptimizations(['cursor'])],
    propTypes: {
        label: React.PropTypes.string.isRequired,
        cursor: React.PropTypes.instanceOf(Cursor).isRequired
    },
    getInitialState(){
        return {cycle:0}
    },
    componentDidMount(){
        //this.cycle=0 //hack...
    },
    componentWillReceiveProps({cursor}){
        //should only happen when switching to a saved search or clearing.
        //don't force a cycle if we're focused and receive new props.
        if (!this.focused && (cursor.value != this.props.cursor.value))
            this.setState({cycle: this.state.cycle + 1}) //cycle++
    },
    nowNotFocused(){
        this.focused = false
    },
    nowFocused(){
        this.focused = true
    },
    inputChange(){
        clearTimeout(this.changeTimeout)
        this.changeTimeout = setTimeout(function(){
            var value = this.refs.input.getValue()
            if (this.props.cursor.value != value)
                this.props.cursor.set(value)
        }.bind(this),200)
    },
    render(){
        return <Row key={this.state.cycle}>
            <Input type='text' label={this.props.label} labelClassName='col-md-3' wrapperClassName='col-md-9' ref='input'
                defaultValue={this.props.cursor.value} onChange={this.inputChange} disabled={this.props.disabled}
                onFocus={this.nowFocused} onBlur={this.nowNotFocused}/>
        </Row>
    }
})

const SelectRow = React.createClass({
    mixins: [ImmutableOptimizations(['cursor','aanCursor'])],
    propTypes: {
        //options: React.PropTypes.instanceOf(Object).isRequired,
        cursor: React.PropTypes.instanceOf(Cursor).isRequired,
        aanCursor: React.PropTypes.instanceOf(Cursor).isRequired,
        onFocus: React.PropTypes.func,
        onBlur: React.PropTypes.func
    },
    selectChange(value){
        var values = (value && allOptions[this.props.name].intArray) ? value.split(',').select(s=>parseInt(s)).join(',') : value
        this.props.cursor.set(values)
    },
    selectValues(){
        var values = this.props.cursor.value
        if (!values) return null
        return allOptions[this.props.name].intArray ? values.split(',').select(i=>i.toString()).join(',') : values
    },
    getOptions(input, callback){
        var options = allOptions[this.props.name].select_options
        callback(null, {options: options, complete: options.length > 0})
        //loadOptions={this.getOptions} autoload={false}
    },
    render(){
        //causing issues. is If wrapping in a <span>?
        var options = allOptions[this.props.name]
        return <Row>
            <Col md={3}>
                <label className="control-label">{options.label}</label>
            </Col>
            <Col md={9}>
                <table style={{width:'100%',borderCollapse:'separate'}}>
                    <tbody>
                    <tr>
                        {(options.allAnyNone) ?
                            <td style={{width: 'auto'}}>
                                <AllAnyNoneButton cursor={this.props.aanCursor} canAll={options.canAll}/>
                            </td> : null}
                        <td style={{width:'100%'}}>
                            <Select simpleValue multi={options.multi} ref='select'
                                options={options.select_options}
                                value={this.selectValues()} placeholder='' clearable={options.multi}
                                onChange={this.selectChange} onFocus={this.props.onFocus} onBlur={this.props.onBlur} />
                        </td>
                    </tr>
                    </tbody>
                </table>
            </Col>
        </Row>
    }
})

const BalancingRow = React.createClass({
    mixins: [LinkedComplexCursorMixin(), Reflux.ListenerMixin, ImmutableOptimizations(['cursor'])],
    propTypes: {
        options: React.PropTypes.instanceOf(Object).isRequired,
        cursor: React.PropTypes.instanceOf(Cursor).isRequired
    },
    getInitialState(){
        return {slices:[],slices_count:0}
    },
    getDefaultCursor(){return {enabled:false,hideshow:'hide',ltgt:'gt',percent:0,allactive:'active'}},
    componentDidMount(){
        this.lastResult = {}
        this.cycle=0
        this.listenTo(a.criteria.balancing.get.completed, this.receivedKivaSlices)
        this.performBalanceQuery(this.props.cursor)
    },
    performBalanceQuery(cursor){
        if (cursor.value && cursor.refine('enabled').value) {
            var newReq = JSON.stringify(cursor.value) + this.props.options.slice_by
            if (newReq == this.lastRequest) return //we've done it already!
            this.lastRequest = newReq
            s.criteria.onBalancingGet(newReq, this.props.options.slice_by, cursor.value, function(){
                this.setState({loading:true})
                this.forceUpdate() //wouldn't happen otherwise due to optimizations
            }.bind(this))
        }
    },
    compareButIgnore(obj1, obj2, property){
        var obj1c = extend(true,{},obj1)
        var obj2c = extend(true,{},obj2)
        delete obj1c[property]
        delete obj2c[property]
        return JSON.stringify(obj1c) == JSON.stringify(obj2c)
    },
    componentWillReceiveProps({cursor}){ //a criteria is loaded (or flows back down??)
        if (cursor != this.props.cursor) {
            if (!this.compareButIgnore(cursor.value, this.props.cursor.value, 'values')) {
                if (!this.percentFocused) //if focused, then the the props change is probably because user is typing.
                    this.cycle++
                this.performBalanceQuery(cursor)
            }
        }
    },
    percentChange(text){
        clearTimeout(this.percentChangeTimeout)
        this.percentChangeTimeout = setTimeout(function(){
            var value = parseFloat(this.refs.percent.value)
            if (!isNaN(value)) {
                this.props.cursor.refine('percent').set(value)
            }
        }.bind(this),50)
    },
    percentFocus(){
        this.percentFocused=true
    },
    percentBlur(){
        this.percentFocused=false
    },
    receivedKivaSlices(lastRequest, sliceBy, crit, result){
        //must only look at the request that it made. I'd rather have this be a promise than reflux. :(
        if (this.lastRequest == lastRequest){
            this.setState({loading: false})
            this.forceUpdate()
            this.lastResult = result

            if (!Array.isArray(result.slices)) return
            var slices = result.slices
            //'values' are what is passed through to the filtering. slices is for display.
            var values = (this.props.options.key == 'id') ? slices.select(s => parseInt(s.id)) : slices.select(s => s.name)
            this.cursor().refine('values').set(values)
            this.setState({slices, slices_count: slices.length, lastUpdated: this.lastResult.last_updated * 1000})
            this.forceUpdate() //necessary
        }
    },
    render(){
        var options = this.props.options
        let {loading, slices, slices_count, lastUpdated} = this.state
        let {enabled, percent=5} = (this.cursor().value || {})
        //[x] [Hide/Show] Partners that have [</>] [12]% of my [total/active] portfolio
        var lcHS = this.linkCursor('hideshow')
        var lcLG = this.linkCursor('ltgt')
        var lcAA = this.linkCursor('allactive')
        var lcE = this.linkCursor('enabled')
        return <Row>
            <Col md={2}>
                <label className="control-label">{options.label}</label>
            </Col>
            <Col md={10}>
                <Input type="checkbox" label='Enable filter' checkedLink={lcE}/>
                <Row className={cx('spacedChildren', {notEnabled: !lcE.value})}>
                    <DropSelectButton style={{width:'53px'}} onChange={lcHS.requestChange} value={lcHS.value} options={[{label: 'Only Show', buttonDisplay: 'Show', value: 'show'}, {label: "Hide all", buttonDisplay: 'Hide', value: 'hide'}]} defaultValue='hide'/>
                    <div style={{minWidth:'125px',margin:'5px'}}>{options.label.toLowerCase()} that have</div>
                    <DropSelectButton onChange={lcLG.requestChange} value={lcLG.value} options={[{label: '< Less than',buttonDisplay: '<', value: 'lt'}, {label: "> More than", buttonDisplay: '>', value: 'gt'}]} defaultValue='lt'/>
                    <input style={{width:'50px'}} key={this.cycle} type="number" ref="percent"
                            defaultValue={percent} onChange={this.percentChange}
                            onFocus={this.percentFocus} onBlur={this.percentBlur}/>
                    &nbsp; % of my &nbsp;
                    <DropSelectButton onChange={lcAA.requestChange} value={lcAA.value} options={[{label:'Active Portfolio',value:'active'},{label:"Total Portfolio",value:'all'}]} defaultValue='active'/>
                </Row>

                <Row className="ample-padding-top">
                    <If condition={loading}>
                        <Alert>Loading data from Kiva...</Alert>
                    </If>
                    <If condition={enabled && !loading}>
                        <div>
                            Matching: {slices_count}. Loans from these <b>{options.label.toLowerCase()}</b> will be <b>{this.linkCursor('hideshow').value == 'show' ? 'shown' : 'hidden'}</b>.
                            <ul style={{overflowY:'auto',maxHeight:'200px'}}>
                                <For index='i' each='slice' of={slices}>
                                    <li key={i}>
                                        {numeral(slice.percent).format('0.000')}%: {slice.name}
                                    </li>
                                </For>
                            </ul>
                            <If condition={lastUpdated}>
                                <p>Last Updated: <TimeAgo date={new Date(lastUpdated).toISOString()}/></p>
                            </If>
                        </div>
                    </If>
                </Row>
            </Col>
            </Row>
    }
})

const LimitResult = React.createClass({
    mixins: [LinkedComplexCursorMixin(), ImmutableOptimizations(['cursor'])],
    getDefaultCursor(){return {enabled: false, count: 1, limit_by: 'Partner'}},
    render(){
        var lcLB = this.linkCursor('limit_by')
        return <Row>
            <Col md={3}>
                <Input type="checkbox" label={<b>Limit to top</b>} checkedLink={this.linkCursor('enabled')}/>
            </Col>
            <Col md={9}>
                <table style={{width:'100%',borderCollapse:'separate'}}>
                    <tbody>
                        <tr>
                            <td style={{width:'auto'}}>
                                <Input type="text" label='' style={{height:'38px',minWidth:'50px'}}
                                    className='col-xs-2'
                                    disabled={!this.linkCursor('enabled').value}
                                    valueLink={this.linkCursor('count',{type:'integer'})} />
                            </td>
                            <td style={{padding: '5px',fontSize:'x-small'}}>loans per</td>
                            <td style={{width:'80%'}}>
                                <Select simpleValue value={lcLB.value} onChange={lcLB.requestChange}
                                    options={[{value:"Partner",label:"Partner"},{value:'Country',label:'Country'},{value:'Sector',label:'Sector'},{value:'Activity',label:'Activity'}]}
                                    placeholder='' disabled={!this.linkCursor('enabled').value} clearable={false}/>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </Col>
        </Row>
    }
})

const SliderRow = React.createClass({
    mixins: [ImmutableOptimizations(['cursorMin','cursorMax','cycle'])], //'cycle' is to force a redraw on tab flips.
    propTypes: {
        options: React.PropTypes.instanceOf(Object).isRequired,
        cursorMin: React.PropTypes.instanceOf(Cursor).isRequired,
        cursorMax: React.PropTypes.instanceOf(Cursor).isRequired
    },
    getInitialState(){
        var s = this.fillMissing({c_min:this.props.cursorMin.value, c_max:this.props.cursorMax.value})
        return s
    },
    pickValue(crit_facet, defaultValue){
        return (crit_facet === null || crit_facet === undefined) ? defaultValue : crit_facet
    },
    shouldComponentUpdateOld({cursorMin,cursorMax},{d_min,d_max}){
        return (d_min != this.state.d_min || d_max != this.state.d_max || cursorMin != this.props.cursorMin || cursorMax != this.props.cursorMax)
    },
    componentWillReceiveProps({cursorMin,cursorMax}){
        if ((this.props.cursorMin.value !== cursorMin.value) || (this.props.cursorMax.value !== cursorMax.value)) {
            this.setState(this.fillMissing({c_min: cursorMin.value, c_max: cursorMax.value})) //not forceUpdate needed because it will re-render
        }
        return true
    },
    fillMissing(s){
        //a_ absolute/slider values; no nulls, o_ options , c_ cursor/criteria with nulls, d_ display
        s.o_min = this.props.options.min
        s.o_max = this.props.options.max

        //if the slider values are set, set the criteria to match
        if (s.a_min !== null && s.a_min !== undefined) s.c_min = s.a_min
        if (s.a_max !== null && s.a_max !== undefined) s.c_max = s.a_max

        //if the criteria is set, set the values for the sliders.
        if (s.c_min !== null && s.c_min !== undefined) s.a_min = s.c_min
        if (s.c_max !== null && s.c_max !== undefined) s.a_max = s.c_max

        //if the criteria is at upper/lower bound (missing), take the upper lower from options.
        if (s.c_min === null || s.c_min === undefined || isNaN(s.c_min))
            s.a_min = s.o_min
        if (s.c_max === null || s.c_max === undefined || isNaN(s.c_max))
            s.a_max = s.o_max

        //if the criteria is at upper/lower bound set it to null
        if (s.c_min == s.o_min) s.c_min = null
        if (s.c_max == s.o_max) s.c_max = null

        //set the display to the control settings, unless it's at the upper/lower boundary
        s.d_min = s.a_min
        s.d_max = s.a_max
        if (s.c_min===null || s.c_min===undefined || s.c_min == s.o_min) s.d_min='min'
        if (s.c_max===null || s.c_max===undefined || s.c_max == s.o_max) s.d_max='max'

        return s
    },
    sliderChange(arr){
        if (arr.length == 2) {
            var ns = this.fillMissing({a_min:arr[0],a_max:arr[1]})
            this.setState(ns)
            this.forceUpdate()

            //after a quick breath, set the cursor
            clearTimeout(this.changeTimeout)
            this.changeTimeout = setTimeout(function(){
                this.props.cursorMin.set(ns.c_min)
                this.props.cursorMax.set(ns.c_max)
            }.bind(this), 250)
        }
    },
    render() {
        var options = this.props.options
        let {a_min,a_max,d_min,d_max,o_min,o_max}=this.state
        var step = options.step || 1
        return (<Row>
            <Col md={3}>
                <OverlayTrigger rootClose={true} trigger={options.helpText ? ["hover","focus","click"] : "none"}
                    placement="top" overlay={<Popover id={options.label} title={options.label}>{options.helpText}</Popover>}>
                    <label style={{'borderBottom': '#333 1px dotted'}} className="control-label">{options.label}</label>
                </OverlayTrigger>
                <p>{d_min}-{d_max}</p>
            </Col>
            <Col md={9}>
                <Slider className='horizontal-slider' min={o_min} max={o_max}
                    value={[a_min,a_max]} step={step} withBars onChange={this.sliderChange} />
            </Col>
        </Row>)
    }
})

const CriteriaTabs = React.createClass({
    mixins: [Reflux.ListenerMixin, LinkedStateMixin, DelayStateTriggerMixin('criteria','performSearch', 50)],
    getInitialState() {
        return { activeTab: 1, portfolioTab: '', helper_charts: {}, visionFaceKeys:[], helper_chart_height: 400, needLenderID: false,
             criteria: s.criteria.syncGetLast(), KLA: {}, RSSLinkTo: 'kiva', loansReady: false, descriptionsLoaded: false}
    },
    componentDidMount() {
        var opts = lsj.get("Options")
        var visionFaceKeys = [] //opts.betaTester || true ? ['joy','sorrow','anger','headwear'] : [] //'surprise'
        this.setState({kiva_lender_id: opts.kiva_lender_id, visionFaceKeys, isMobile: mobileAndTabletCheck()})
        this.listenTo(a.loans.load.completed, this.loansReady)
        this.listenTo(a.criteria.lenderLoansEvent, this.lenderLoansEvent)
        this.listenTo(a.criteria.reload, this.reloadCriteria)
        this.listenTo(a.loans.filter.completed, this.filteredDone)
        this.listenTo(a.criteria.atheistListLoaded, this.figureAtheistList)
        this.listenTo(a.loans.load.descriptions, this.checkDescriptionsLoaded)
        this.listenTo(a.loans.refresh, this.performSearch)
        this.listenTo(a.loans.load.secondaryLoad, status=>{if (status == 'complete') this.performSearch()})
        if (kivaloans.isReady()) this.loansReady()
        this.checkDescriptionsLoaded()
        KLAFeatureCheck(['setAutoLendPartners']).done(state => this.setState({KLA:state}))
    },
    checkDescriptionsLoaded(){
        var criteria = s.criteria.syncGetLast()
        if (criteria.loan && criteria.loan.use)
            this.setState({criteria}) //only refresh the loans if the criteria has a use/descr search.
        this.setState({descriptionsLoaded: kivaloans.allDescriptionsLoaded})
    },
    figureAtheistList(){
        this.setState({displayAtheistOptions: lsj.get("Options").mergeAtheistList && kivaloans.atheist_list_processed})
    },
    filteredDone(loans,sameAsLastTime){
        if (!(this.last_select && this.last_select.key)) return
        // if (sameAsLastTime) return
        //if we are in a selection box and that box is matching all (themes, tags, social perf), then rebuild the graphs
        let {key, group} = this.last_select
        var cg = this.state.criteria[group]
        if (cg[`${key}_all_any_none`] == 'all' || (allOptions[key].canAll && !cg[`${key}_all_any_none`]))
            this.genHelperGraphs(group, key, loans)
    },
    reloadCriteria(criteria = {}){
        this.setState({criteria: extend(true, {}, s.criteria.syncBlankCriteria(), criteria)})
    },
    lenderLoansEvent(event){
        //can be either started or done.
        var newState = {}
        newState.portfolioTab = (event == 'started') ? " (loading...)" : ""
        this.setState(newState)
        this.performSearch()
    },
    loansReady(){
        //this runs twice during load and every time you switch to the tab
        //allOptions.activity.select_options = kivaloans.activities.select(a => {return {value: a, label: a}})
        //allOptions.country_code.select_options = kivaloans.countries.select(c => {return {label: c.name, value: c.iso_code}})
        if (allOptions.partners.select_options.length == 0)
            allOptions.partners.select_options = kivaloans.active_partners.orderBy(p=>p.name).select(p=>({label:p.name,value:p.id.toString()}))
        this.setState({loansReady: true})
        this.figureAtheistList()
    },
    figureNeedLender(crit){
        var por = crit.portfolio
        //if any of the balancers are present and enabled, show message that they need to have their lender id
        var needLenderID = ['pb_country','pb_partner','pb_activity','pb_sector'].any(n => por && por[n] && por[n].enabled)
        needLenderID = (needLenderID && kivaloans.isReady() && !kivaloans.lender_id)
        if (this.state.needLenderID != needLenderID)
            this.setState({needLenderID})
    },
    performSearch(){
        var criteria = this.buildCriteria()
        this.figureNeedLender(criteria)
        a.criteria.change(criteria)
    },
    buildCriteria(){
        var criteria = s.criteria.stripNullValues(extend(true, {}, s.criteria.syncBlankCriteria(), this.state.criteria))
        cl("######### buildCriteria: criteria", criteria)
        return criteria
    },
    buildCriteriaWithout(group, key){
        var crit = this.buildCriteria()
        delete crit[group][key]
        return crit
    },
    performSearchWithout(group, key){
        return s.loans.syncFilterLoans(this.buildCriteriaWithout(group, key), false)
    },
    tabSelect(selectedKey){
        if (this.state.activeTab != selectedKey) {
            this.setState({activeTab: selectedKey})
        }
    },
    genHelperGraphs(group, key, loans){
        //helper graphs are the bars that show down the right side of the page.
        var data
        switch (key){
            case 'country_code':
                data = loans.groupByWithCount(l=>l.location.country)
                break
            case 'sector':
                data = loans.groupByWithCount(l=>l.sector)
                break
            case 'activity':
                data = loans.groupByWithCount(l=>l.activity)
                break
            case 'tags':
                data = loans.select(l => l.kls_tags).flatten().groupByWithCount(t => humanize(t))
                break
            case 'themes':
                data = loans.select(l => l.themes).flatten().where(t => t != undefined).groupByWithCount()
                break
            case 'currency_exchange_loss_liability':
                data = loans.groupByWithCount(l=>l.terms.loss_liability.currency_exchange)
                break
            case 'bonus_credit_eligibility':
                data = loans.groupByWithCount(l=>l.bonus_credit_eligibility === true)
                break
            case 'direct':
                data = loans.groupByWithCount(l=> l.partner_id == null ? 'Direct': "MFI" )
                break
            case 'repayment_interval':
                data = loans.groupByWithCount(l=>l.terms.repayment_interval ? l.terms.repayment_interval : "unknown")
                break
            case 'social_performance':
                data = loans.select(l => l.getPartner().social_performance_strengths).flatten().where(sp => sp != undefined).groupByWithCount(sp => sp.name)
                break
            case 'partners':
                data = loans.groupByWithCount(l => l.getPartner().name)
                break
            case 'region': //this won't come out with the right number of loans....
                data = loans.select(l => l.getPartner().countries).flatten().select(c => c.region).groupByWithCount()
                break
            case 'charges_fees_and_interest':
                data = loans.select(l => l.getPartner().charges_fees_and_interest).groupByWithCount()
                break
            //VISION STUFF
            case 'vision_face_joy':
                data = loans.select(l => l.kl_faces && l.kl_faces.joy? l.kl_faces.joy: []).flatten().groupByWithCount(t => humanize(t).toLowerCase())
                break
            case 'vision_face_sorrow':
                data = loans.select(l => l.kl_faces && l.kl_faces.sorrow? l.kl_faces.sorrow: []).flatten().groupByWithCount(t => humanize(t).toLowerCase())
                break
            case 'vision_face_anger':
                data = loans.select(l => l.kl_faces && l.kl_faces.anger? l.kl_faces.anger: []).flatten().groupByWithCount(t => humanize(t).toLowerCase())
                break
            case 'vision_face_surprise':
                data = loans.select(l => l.kl_faces && l.kl_faces.surprise? l.kl_faces.surprise: []).flatten().groupByWithCount(t => humanize(t).toLowerCase())
                break
            case 'vision_face_headwear':
                data = loans.select(l => l.kl_faces && l.kl_faces.headwear? l.kl_faces.headwear: []).flatten().groupByWithCount(t => humanize(t).toLowerCase())
                break
            default:
                return
        }

        data = data.orderBy(d=>d.count, basicReverseOrder)

        var config = {
            chart: {type: 'bar',
                animation: false ,
                renderTo: 'loan_options_graph'
            },
            title: {text: allOptions[key].label},
            xAxis: {
                categories: data.select(d => d.name),
                title: {text: null}
            },
            yAxis: {
                min: 0,
                dataLabels: {enabled: false},
                labels: {overflow: 'justify'},
                title: {text: 'Matching Loans'}
            },
            plotOptions: {
                bar: {
                    dataLabels: {
                        enabled: true,
                        format: '{y:.0f}'
                    }
                }
            },
            legend: {enabled: false},
            credits: {enabled: false},
            series: [{
                animation: false,
                name: 'Loans',
                data: data.select(d => d.count)
            }]
        }
        var helper_chart_height = Math.max(300, Math.min(data.length * 30, 1300))
        var newState = {helper_charts: {}, helper_chart_height}
        newState.helper_charts[group] = config
        this.setState(newState)
    },
    focusSelect(group, key){
        if ('lg' != findBootstrapEnv()) return //if we're not on a desktop

        this.last_select = {group, key}

        //do we ignore what is in the select
        var ignore_values = false

        var cg = this.state.criteria[group]

        if (cg[`${key}_all_any_none`] == 'all' || (allOptions[key].canAll && !cg[`${key}_all_any_none`]))
            ignore_values = true

        var loans = ignore_values ? s.loans.syncFilterLoansLast() : this.performSearchWithout(group, key)

        this.genHelperGraphs(group, key, loans)
    },
    removeGraphs(){
        this.last_select = {}
        this.setState({helper_charts: {}})
    },
    render() {
        let {isMobile, visionFaceKeys, needLenderID, RSSName, RSSLinkTo, activeTab, loansReady, descriptionsLoaded, kiva_lender_id, criteria, helper_charts, helper_chart_height, portfolioTab, displayAtheistOptions} = this.state
        var cursor = Cursor.build(this).refine('criteria')
        var cLoan = cursor.refine('loan')
        var cPartner = cursor.refine('partner')
        var cPortfolio = cursor.refine('portfolio')
        var lender_loans_message = kivaloans.lender_loans_message //todo: find a better way

        if (activeTab == 5){
            var critRSS = s.criteria.prepForRSS(extend({feed: {name: RSSName, link_to: RSSLinkTo}},this.state.criteria))
            var critRSSUrl = encodeURIComponent(JSON.stringify(critRSS))
        }

        return <div>
            <Tabs animation={false} activeKey={activeTab} onSelect={this.tabSelect}>
                <If condition={location.hostname == '$$localhost'}>
                    <pre>{JSON.stringify(criteria, null, 2)}</pre>
                </If>

                <If condition={needLenderID}>
                    <Alert bsStyle="danger">The options in your criteria require your Lender ID. Go to the Options page to set it.</Alert>
                </If>

                <Tab eventKey={1} title="Borrower" className="ample-padding-top">
                    <Col lg={8}>
                        <InputRow label='Use or Description' cursor={cLoan.refine('use')} disabled={!descriptionsLoaded} />
                        <InputRow label='Name' cursor={cLoan.refine('name')} />

                        <For each='name' index='i' of={['country_code','sector','activity','themes','tags','repayment_interval','currency_exchange_loss_liability','bonus_credit_eligibility','sort']}>
                            <SelectRow key={i} name={name} cursor={cLoan.refine(name)} aanCursor={cLoan.refine(`${name}_all_any_none`)} onFocus={this.focusSelect.bind(this, 'loan', name)} onBlur={this.removeGraphs}/>
                        </For>

                        <For each='name' index='i' of={visionFaceKeys}>
                            <SelectRow key={i} name={`vision_face_${name}`} cursor={cLoan.refine(`vision_face_${name}`)} aanCursor={cLoan.refine(`vision_face_${name}_all_any_none`)} onFocus={this.focusSelect.bind(this, 'loan', `vision_face_${name}`)} onBlur={this.removeGraphs}/>
                        </For>

                        <LimitResult cursor={cLoan.refine('limit_to')}/>

                        <For each='name' index='i' of={['repaid_in','borrower_count','percent_female','age','loan_amount','still_needed','percent_funded','dollars_per_hour','expiring_in_days', 'disbursal_in_days']}>
                            <SliderRow key={i} cursorMin={cLoan.refine(`${name}_min`)} cursorMax={cLoan.refine(`${name}_max`)} cycle={activeTab} options={allOptions[name]}/>
                        </For>
                    </Col>

                    <Col lg={4} className='visible-lg-block' id='loan_options_graph'>
                        <If condition={helper_charts.loan}>
                            <Highcharts key={helper_chart_height} style={{height: `${helper_chart_height}px`}} config={helper_charts.loan}/>
                        </If>
                    </Col>
                </Tab>

                <Tab eventKey={2} title="Partner" className="ample-padding-top">
                    <Row>
                    <Col lg={8}>
                        <SelectRow name="direct" cursor={cPartner.refine('direct')} aanCursor={cPartner.refine(`direct_all_any_none`)}  onFocus={this.focusSelect.bind(this, 'partner', "direct")} onBlur={this.removeGraphs} />
                        <For each='name' index='i' of={['region','partners','social_performance','charges_fees_and_interest']}>
                            <SelectRow key={i} name={name} cursor={cPartner.refine(name)} aanCursor={cPartner.refine(`${name}_all_any_none`)} onFocus={this.focusSelect.bind(this, 'partner', name)} onBlur={this.removeGraphs}/>
                        </For>
                        <For each='name' index='i' of={['partner_risk_rating','partner_arrears','loans_at_risk_rate','partner_default','portfolio_yield','profit','currency_exchange_loss_rate', 'average_loan_size_percent_per_capita_income','years_on_kiva','loans_posted']}>
                            <SliderRow key={i} cursorMin={cPartner.refine(`${name}_min`)} cursorMax={cPartner.refine(`${name}_max`)} cycle={activeTab} options={allOptions[name]}/>
                        </For>
                        <If condition={displayAtheistOptions}>
                            <For each='name' index='i' of={['secular_rating','social_rating']}>
                                <SliderRow key={`${i}_atheist`} cursorMin={cPartner.refine(`${name}_min`)} cursorMax={cPartner.refine(`${name}_max`)} cycle={activeTab} options={allOptions[name]}/>
                            </For>
                        </If>

                        <Button onClick={a.utils.modal.partnerDisplay}>Export Matching Partners</Button>
                        <PartnerDisplayModal/>
                    </Col>

                    <Col lg={4} className='visible-lg-block' id='loan_options_graph'>
                        <If condition={helper_charts.partner}>
                            <Highcharts key={helper_chart_height} style={{height: `${helper_chart_height}px`}} config={helper_charts.partner} />
                        </If>
                    </Col>
                    </Row>
                </Tab>

                <Tab eventKey={3} title={`Your Portfolio${portfolioTab}`} className="ample-padding-top">
                    <Row>
                        <Col md={10}>
                            <If condition={!kiva_lender_id && !needLenderID}>
                                <Alert bsStyle="danger">You have not yet set your Kiva Lender ID on the <Link to="options">Options</Link> page. These functions won't work until you do.</Alert>
                            </If>

                            To prevent you from accidentally lending to the same borrower twice if their loan is
                            still fundraising, just exclude those loans. {`(${lender_loans_message})`}

                            <For each='name' index='i' of={['exclude_portfolio_loans']}>
                                <SelectRow key={i} name={name} cursor={cPortfolio.refine(name)} aanCursor={cPortfolio.refine(`${name}_all_any_none`)}
                                    onFocus={this.focusSelect.bind(this, 'portfolio', name)} onBlur={this.removeGraphs}  />
                            </For>
                        </Col>
                    </Row>
                    <Row className="ample-padding-top">
                        <Col md={12}>
                            <Panel header='Portfolio Balancing'>
                                <p>
                                    Portfolio Balancing allows you to find loans that are either similar to or unlike
                                    the loans you have in your portfolio (either just the active/paying-back loans
                                    or all of them). So, if you wanted to get loans from every sector
                                    or country, it's easy! Or if you wanted to help make sure you aren't getting too
                                    many loans from a handful of partners to protect yourself from losses due to
                                    institutional failure, that's easy, too!
                                </p>
                                Notes:
                                <ul className="spacedList">
                                    <li>
                                        The summary data that KivaLens pulls for your account is not "live" data.
                                        It should rarely be over 6 hours old, however. This means if you complete a
                                        bunch of loans and come back for more right away, the completed loans will
                                        not be accounted for in the balancing. Look for "Last Updated" to know how
                                        fresh the data is.
                                    </li>
                                    <li>
                                        If you plan to use Bulk Add in conjunction with the balancing tools then
                                        you may also want to look at the "Limit to top" option on the Borrower criteria tab.
                                        This will prevent too many from a given Partner/Country/Sector/Activity from
                                        getting into your basket to keep your portfolio from getting lopsided.
                                    </li>
                                    <li>
                                        Fetching the data from Kiva can sometimes take a few seconds. If you don't see
                                        anything happen right away, just wait. This also applies to loading saved
                                        searches that have balancing options set.
                                    </li>
                                </ul>

                                <If condition={activeTab == 3}>
                                    <div>
                                        <For each='name' index='i' of={['pb_partner', 'pb_country', 'pb_sector', 'pb_activity']}>
                                            <BalancingRow key={i} cursor={cPortfolio.refine(name)} options={allOptions[name]}/>
                                        </For>
                                    </div>
                                </If>
                            </Panel>
                        </Col>
                    </Row>
                </Tab>
                <If condition={!isMobile}>
                    <Tab eventKey={4} title="Auto-Lend" disabled={loansReady != true}>
                        <Col lg={12}>
                            <If condition={activeTab == 4}>
                                <AutoLendSettings />
                            </If>
                        </Col>
                    </Tab>
                </If>
                <If condition={!isMobile}>
                    <Tab eventKey={5} title="RSS">
                        <Row className="ample-padding-top">
                        <Col lg={12}>
                            <If condition={activeTab == 5}>
                                <div>
                                    <p>
                                        With an RSS feed, you can use any number of RSS Readers (including some browsers
                                        or browser extensions), or sites like <NewTabLink href="http://www.ifttt.com">IFTTT (If This Then That)</NewTabLink> to
                                        set up all sorts of actions in response to new items in the feed. You can set
                                        it to send you emails, SMS, Instant Messages, flash your lights, turn on your
                                        sprinklers... You have a lot of options! You can create as many RSS feeds
                                        as you want. <NewTabLink href="https://ifttt.com/recipes/147561-rss-feed-to-email">Create 'Recipe'
                                        to send you an email when loans match your criteria</NewTabLink>.
                                    </p>
                                    <p>
                                        It will only show the first 100 matching loans and it currently doesn't support
                                        anything that requires any knowledge of your portfolio (excluding your
                                        fundraising loans or portfolio balancing).
                                    </p>
                                    <Panel header="RSS Feed Details">
                                        <Input type="text" label='Name (this will appear in your RSS feed reader)' style={{height:'38px',minWidth:'50px'}}
                                               className='col-xs-2'
                                               valueLink={this.linkState('RSSName')} />
                                        <Input type="select" label="Links in RSS go to"
                                               valueLink={this.linkState('RSSLinkTo')}
                                               placeholder="select">
                                            <option value="kiva">Kiva</option>
                                            <option value="kivalens">KivaLens</option>
                                        </Input>

                                    </Panel>
                                    <Panel header="Your Settings">
                                        <p>These are the criteria options that will be used to generate your feed. Anything related to your portfolio has been removed.</p>
                                        <pre>
                                            {JSON.stringify(critRSS, null, 2)}
                                        </pre>
                                    </Panel>
                                    <Panel header="RSS Link">
                                        <p>
                                            Copy and Paste this entire URL into your RSS reader or
                                            use <NewTabLink href="http://www.ifttt.com">If This Then That</NewTabLink> to
                                            create a "recipe" to respond to new items in the news feed and either send
                                            you an email or an SMS.
                                        </p>
                                        <textarea style={{width:'100%',height:'150px'}} readOnly value={`http://www.kivalens.org/rss/${critRSSUrl}`}/>
                                    </Panel>
                                </div>
                            </If>
                        </Col>
                        </Row>
                    </Tab>
                </If>
            </Tabs>
            </div>
    }
})
export default CriteriaTabs