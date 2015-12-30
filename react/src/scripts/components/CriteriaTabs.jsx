'use strict'

import React from 'react'
import {Link} from 'react-router'
import Select from 'react-select'
import Slider from 'react-slider' // 'multi-slider' is incompatible with .14 presently
import Reflux from 'reflux'
import numeral from 'numeral'
import a from '../actions'
import {LinkedComplexCursorMixin,DelayStateTriggerMixin} from './Mixins'
import s from '../stores/'
import {Grid,Row,Col,Input,Button,DropdownButton,MenuItem,Tabs,Tab,Panel,OverlayTrigger,Popover,Alert} from 'react-bootstrap'
import {Cursor, ImmutableOptimizations} from 'react-cursor'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import TimeAgo from 'react-timeago'
var Highcharts = require('react-highcharts/dist/bundle/highcharts')
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'

var timeoutHandle=0

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
    componentDidMount(){
        this.cycle=0 //hack...
    },
    componentWillReceiveProps({cursor}){
        //should only happen when switching to a saved search or clearing.
        //don't force a cycle if we're focused and receive new props.
        if (!this.focused && cursor.value != this.props.cursor.value)
            this.cycle++
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
        return <Row key={this.cycle}>
            <Input type='text' label={this.props.label} labelClassName='col-md-3' wrapperClassName='col-md-9' ref='input'
                defaultValue={this.props.cursor.value} onChange={this.inputChange}
                onFocus={this.nowFocused} onBlur={this.nowNotFocused}/>
        </Row>
    }
})

const SelectRow = React.createClass({
    mixins: [ImmutableOptimizations(['cursor','aanCursor'])],
    propTypes: {
        options: React.PropTypes.instanceOf(Object).isRequired,
        cursor: React.PropTypes.instanceOf(Cursor).isRequired,
        aanCursor: React.PropTypes.instanceOf(Cursor).isRequired,
        onFocus: React.PropTypes.func
    },
    selectChange(value){
        var values = (value && this.props.options.intArray) ? value.split(',').select(s=>parseInt(s)).join(',') : value
        this.props.cursor.set(values)
    },
    selectValues(){
        var values = this.props.cursor.value
        if (!values) return null
        return this.props.options.intArray ? values.split(',').select(i=>`${i}`).join(',') : values
    },
    render(){
        //causing issues. is If wrapping in a <span>?
        var options = this.props.options
        return <Row>
            <Col md={3}>
                <label className="control-label">{options.label}</label>
            </Col>
            <Col md={9}>
                <table style={{width:'100%',borderCollapse:'separate'}}>
                    <tbody>
                    <tr>
                        <If condition={options.allAnyNone}>
                            <td style={{width:'auto'}}>
                                <AllAnyNoneButton cursor={this.props.aanCursor} canAll={options.canAll}/>
                            </td>
                        </If>
                        <td style={{width:'100%'}}><Select simpleValue multi={options.multi} ref='select'
                            value={this.selectValues()} options={options.select_options} placeholder='' clearable={options.multi}
                            onChange={this.selectChange} onFocus={this.props.onFocus} onBlur={this.props.onBlur} /></td>
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
    getDefaultCursor(){return {enabled:false,hideshow:'hide',ltgt:'gt',percent:5,allactive:'active'}},
    componentDidMount(){
        this.lastResult = {}
        this.cycle=0
        this.listenTo(a.criteria.balancing.get.completed, this.receivedKivaSlices)
        this.performBalanceQuery(this.props.cursor)
    },
    performBalanceQuery(cursor){
        if (cursor.value && cursor.refine('enabled').value) {
            var newReq = JSON.stringify(cursor.value)
            if (newReq == this.lastRequest) return //we've done it already!
            this.lastRequest = newReq
            s.criteria.onBalancingGet(newReq, this.props.options.slice_by, cursor.value, function(){
                this.setState({loading:true})
                this.forceUpdate() //wouldn't happen otherwise due to optimizations
            }.bind(this))
        }
    },
    compareButIgnore(obj1, obj2, property){
        var obj1c = $.extend(true,{},obj1)
        var obj2c = $.extend(true,{},obj2)
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
    percentChange(){
        clearTimeout(this.percentChangeTimeout)
        this.percentChangeTimeout = setTimeout(function(){
            var value = parseFloat(this.refs.percent.getValue())
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
            this.setState({slices: slices, slices_count: slices.length, lastUpdated: this.lastResult.last_updated * 1000})
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
        return <Row>
            <Col md={2}>
                <label className="control-label">{options.label}</label>
            </Col>
            <Col md={10}>
                <Input type="checkbox" label='Enable filter' checkedLink={this.linkCursor('enabled')}/>
                <Row>
                    <Select simpleValue clearable={false} options={[{label: 'Show only', value: 'show'}, {label: "Hide all", value: 'hide'}]}
                        value={lcHS.value} onChange={lcHS.requestChange} className='col-xs-4' />
                    <Col xs={4}>
                        {options.label.toLowerCase()} that have
                    </Col>
                </Row>
                <Row>
                    <Select simpleValue clearable={false} value={lcLG.value} onChange={lcLG.requestChange} className='col-xs-4'
                        options={[{label: '< Less than', value: 'lt'}, {label: "> More than", value: 'gt'}]}/>
                    <Col xs={4}>
                        <Input key={this.cycle} type="text" label='' ref="percent" className='col-xs-2'
                            defaultValue={percent} onChange={this.percentChange}
                            onFocus={this.percentFocus} onBlur={this.percentBlur}/>
                    </Col>
                    <Col xs={3}>
                        %
                    </Col>
                </Row>
                <Row>
                    <Col xs={3}>
                        of my
                    </Col>
                    <Select simpleValue clearable={false} value={lcAA.value} onChange={lcAA.requestChange} className='col-xs-5'
                        options={[{label:'Active Portfolio',value:'active'},{label:"Total Portfolio",value:'all'}]}/>
                </Row>

                <Row>
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
    shouldComponentUpdateOLD(np,{d_min,d_max}){
        return (d_min != this.state.d_min || d_max != this.state.d_max)
    },
    componentWillReceiveProps({cursorMin,cursorMax}, newState){
        if ((this.props.cursorMin.value !== cursorMin.value) || (this.props.cursorMax.value !== cursorMax.value)) {
            this.setState(this.fillMissing({c_min: cursorMin.value, c_max: cursorMax.value})) //not forceUpdate needed because it will re-render
        }
        return true
    },
    fillMissing(s){
        //a_ absolute. no nulls, o_ options, c_ cursor/criteria with nulls, d_ display
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
    mixins: [Reflux.ListenerMixin, DelayStateTriggerMixin('criteria','performSearch', 50)],
    getInitialState: function () {
        return { activeTab: 1, portfolioTab: '', helper_charts: {}, needLenderID: false, criteria: s.criteria.syncGetLast()}
    },
    componentWillMount(){
        this.options = {}
        this.setKnownOptions()
    },
    componentDidMount() {
        this.setState({kiva_lender_id: lsj.get("Options").kiva_lender_id})
        this.listenTo(a.loans.load.completed, this.loansReady)
        this.listenTo(a.criteria.lenderLoansEvent, this.lenderLoansEvent)
        this.listenTo(a.criteria.reload, this.reloadCriteria)
        this.listenTo(a.loans.filter.completed, this.filteredDone)
        this.listenTo(a.criteria.atheistListLoaded, this.figureAtheistList)
        if (kivaloans.isReady()) this.loansReady()
    },
    figureAtheistList(){
        this.setState({displayAtheistOptions: lsj.get("Options").mergeAtheistList && kivaloans.atheist_list_processed})
    },
    filteredDone(loans){
        if (!(this.last_select && this.last_select.key)) return
        //if we are in a selection box and that box is matching all (themes, tags, social perf), then rebuild the graphs
        let {key, group} = this.last_select
        var cg = this.state.criteria[group]
        if (cg[`${key}_all_any_none`] == 'all' || (this.options[key].canAll && !cg[`${key}_all_any_none`])) {
            this.genHelperGraphs(group, key, loans)
        }
    },
    reloadCriteria(criteria = {}){
        this.setState({criteria: $.extend(true, {}, s.criteria.syncBlankCriteria(), criteria)})
    },
    lenderLoansEvent(event){
        //can be either started or done.
        var newState = {}
        newState.portfolioTab = (event == 'started') ? " (loading...)" : ""
        this.setState(newState)
        this.performSearch()
    },
    loansReady(){
        //this.options.activity.select_options = kivaloans.activities.select(a => {return {value: a, label: a}})
        //this.options.country_code.select_options = kivaloans.countries.select(c => {return {label: c.name, value: c.iso_code}})
        this.options.partners.select_options = kivaloans.partners_from_kiva.where(p=>p.status=="active").orderBy(p=>p.name).select(p=>({label:p.name,value:p.id.toString()}))
        this.setState({loansReady : true})
        this.figureAtheistList()
    },
    setKnownOptions(){
        //loan selects
        this.options.country_code = {label: 'Countries', allAnyNone: true, multi: true, select_options: [{"label":"Afghanistan","value":"AF"},{"label":"Albania","value":"AL"},{"label":"Armenia","value":"AM"},{"label":"Azerbaijan","value":"AZ"},{"label":"Belize","value":"BZ"},{"label":"Benin","value":"BJ"},{"label":"Bolivia","value":"BO"},{"label":"Bosnia and Herzegovina","value":"BA"},{"label":"Brazil","value":"BR"},{"label":"Bulgaria","value":"BG"},{"label":"Burkina Faso","value":"BF"},{"label":"Burundi","value":"BI"},{"label":"Cambodia","value":"KH"},{"label":"Cameroon","value":"CM"},{"label":"Chad","value":"TD"},{"label":"Chile","value":"CL"},{"label":"China","value":"CN"},{"label":"Colombia","value":"CO"},{"label":"Congo","value":"CG"},{"label":"Costa Rica","value":"CR"},{"label":"Cote D'Ivoire","value":"CI"},{"label":"Dominican Republic","value":"DO"},{"label":"Ecuador","value":"EC"},{"label":"Egypt","value":"EG"},{"label":"El Salvador","value":"SV"},{"label":"Gaza","value":"GZ"},{"label":"Georgia","value":"GE"},{"label":"Ghana","value":"GH"},{"label":"Guatemala","value":"GT"},{"label":"Haiti","value":"HT"},{"label":"Honduras","value":"HN"},{"label":"India","value":"IN"},{"label":"Indonesia","value":"ID"},{"label":"Iraq","value":"IQ"},{"label":"Israel","value":"IL"},{"label":"Jordan","value":"JO"},{"label":"Kenya","value":"KE"},{"label":"Kosovo","value":"XK"},{"label":"Kyrgyzstan","value":"KG"},{"label":"Lao People's Democratic Republic","value":"LA"},{"label":"Lebanon","value":"LB"},{"label":"Lesotho","value":"LS"},{"label":"Liberia","value":"LR"},{"label":"Madagascar","value":"MG"},{"label":"Malawi","value":"MW"},{"label":"Mali","value":"ML"},{"label":"Mauritania","value":"MR"},{"label":"Mexico","value":"MX"},{"label":"Moldova","value":"MD"},{"label":"Mongolia","value":"MN"},{"label":"Mozambique","value":"MZ"},{"label":"Myanmar (Burma)","value":"MM"},{"label":"Namibia","value":"NA"},{"label":"Nepal","value":"NP"},{"label":"Nicaragua","value":"NI"},{"label":"Nigeria","value":"NG"},{"label":"Pakistan","value":"PK"},{"label":"Palestine","value":"PS"},{"label":"Panama","value":"PA"},{"label":"Papua New Guinea","value":"PG"},{"label":"Paraguay","value":"PY"},{"label":"Peru","value":"PE"},{"label":"Philippines","value":"PH"},{"label":"Rwanda","value":"RW"},{"label":"Saint Vincent and the Grenadines","value":"VC"},{"label":"Samoa","value":"WS"},{"label":"Senegal","value":"SN"},{"label":"Sierra Leone","value":"SL"},{"label":"Solomon Islands","value":"SB"},{"label":"Somalia","value":"SO"},{"label":"South Africa","value":"ZA"},{"label":"South Sudan","value":"QS"},{"label":"Sri Lanka","value":"LK"},{"label":"Suriname","value":"SR"},{"label":"Tajikistan","value":"TJ"},{"label":"Tanzania","value":"TZ"},{"label":"Thailand","value":"TH"},{"label":"The Democratic Republic of the Congo","value":"CD"},{"label":"Timor-Leste","value":"TL"},{"label":"Togo","value":"TG"},{"label":"Turkey","value":"TR"},{"label":"Uganda","value":"UG"},{"label":"Ukraine","value":"UA"},{"label":"United States","value":"US"},{"label":"Vanuatu","value":"VU"},{"label":"Vietnam","value":"VN"},{"label":"Yemen","value":"YE"},{"label":"Zambia","value":"ZM"},{"label":"Zimbabwe","value":"ZW"}]}
        this.options.sector = {label: 'Sectors', allAnyNone: true, multi: true, select_options: [{"value":"Agriculture","label":"Agriculture"},{"value":"Arts","label":"Arts"},{"value":"Clothing","label":"Clothing"},{"value":"Construction","label":"Construction"},{"value":"Education","label":"Education"},{"value":"Entertainment","label":"Entertainment"},{"value":"Food","label":"Food"},{"value":"Health","label":"Health"},{"value":"Housing","label":"Housing"},{"value":"Manufacturing","label":"Manufacturing"},{"value":"Personal Use","label":"Personal Use"},{"value":"Retail","label":"Retail"},{"value":"Services","label":"Services"},{"value":"Transportation","label":"Transportation"},{"value":"Wholesale","label":"Wholesale"}]}
        this.options.activity = {label: 'Activities', allAnyNone: true, multi: true, select_options: [{"label":"Agriculture","value":"Agriculture"},{"label":"Air Conditioning","value":"Air Conditioning"},{"label":"Animal Sales","value":"Animal Sales"},{"label":"Arts","value":"Arts"},{"label":"Auto Repair","value":"Auto Repair"},{"label":"Bakery","value":"Bakery"},{"label":"Balut-Making","value":"Balut-Making"},{"label":"Barber Shop","value":"Barber Shop"},{"label":"Beauty Salon","value":"Beauty Salon"},{"label":"Bicycle Repair","value":"Bicycle Repair"},{"label":"Bicycle Sales","value":"Bicycle Sales"},{"label":"Blacksmith","value":"Blacksmith"},{"label":"Bookbinding","value":"Bookbinding"},{"label":"Bookstore","value":"Bookstore"},{"label":"Bricks","value":"Bricks"},{"label":"Butcher Shop","value":"Butcher Shop"},{"label":"Cafe","value":"Cafe"},{"label":"Call Center","value":"Call Center"},{"label":"Carpentry","value":"Carpentry"},{"label":"Catering","value":"Catering"},{"label":"Cattle","value":"Cattle"},{"label":"Cement","value":"Cement"},{"label":"Cereals","value":"Cereals"},{"label":"Charcoal Sales","value":"Charcoal Sales"},{"label":"Cheese Making","value":"Cheese Making"},{"label":"Child Care","value":"Child Care"},{"label":"Cloth & Dressmaking Supplies","value":"Cloth & Dressmaking Supplies"},{"label":"Clothing","value":"Clothing"},{"label":"Clothing Sales","value":"Clothing Sales"},{"label":"Cobbler","value":"Cobbler"},{"label":"Computers","value":"Computers"},{"label":"Construction","value":"Construction"},{"label":"Construction Supplies","value":"Construction Supplies"},{"label":"Consumer Goods","value":"Consumer Goods"},{"label":"Cosmetics Sales","value":"Cosmetics Sales"},{"label":"Crafts","value":"Crafts"},{"label":"Dairy","value":"Dairy"},{"label":"Decorations Sales","value":"Decorations Sales"},{"label":"Dental","value":"Dental"},{"label":"Education provider","value":"Education provider"},{"label":"Electrical Goods","value":"Electrical Goods"},{"label":"Electrician","value":"Electrician"},{"label":"Electronics Repair","value":"Electronics Repair"},{"label":"Electronics Sales","value":"Electronics Sales"},{"label":"Embroidery","value":"Embroidery"},{"label":"Entertainment","value":"Entertainment"},{"label":"Farm Supplies","value":"Farm Supplies"},{"label":"Farming","value":"Farming"},{"label":"Film","value":"Film"},{"label":"Fish Selling","value":"Fish Selling"},{"label":"Fishing","value":"Fishing"},{"label":"Flowers","value":"Flowers"},{"label":"Food","value":"Food"},{"label":"Food Market","value":"Food Market"},{"label":"Food Production/Sales","value":"Food Production/Sales"},{"label":"Food Stall","value":"Food Stall"},{"label":"Fruits & Vegetables","value":"Fruits & Vegetables"},{"label":"Fuel/Firewood","value":"Fuel/Firewood"},{"label":"Funeral Expenses","value":"Funeral Expenses"},{"label":"Furniture Making","value":"Furniture Making"},{"label":"Games","value":"Games"},{"label":"General Store","value":"General Store"},{"label":"Goods Distribution","value":"Goods Distribution"},{"label":"Grocery Store","value":"Grocery Store"},{"label":"Hardware","value":"Hardware"},{"label":"Health","value":"Health"},{"label":"Higher education costs","value":"Higher education costs"},{"label":"Home Appliances","value":"Home Appliances"},{"label":"Home Energy","value":"Home Energy"},{"label":"Home Products Sales","value":"Home Products Sales"},{"label":"Hotel","value":"Hotel"},{"label":"Internet Cafe","value":"Internet Cafe"},{"label":"Jewelry","value":"Jewelry"},{"label":"Knitting","value":"Knitting"},{"label":"Land Rental","value":"Land Rental"},{"label":"Laundry","value":"Laundry"},{"label":"Liquor Store / Off-License","value":"Liquor Store / Off-License"},{"label":"Livestock","value":"Livestock"},{"label":"Machine Shop","value":"Machine Shop"},{"label":"Machinery Rental","value":"Machinery Rental"},{"label":"Manufacturing","value":"Manufacturing"},{"label":"Medical Clinic","value":"Medical Clinic"},{"label":"Metal Shop","value":"Metal Shop"},{"label":"Milk Sales","value":"Milk Sales"},{"label":"Mobile Phones","value":"Mobile Phones"},{"label":"Motorcycle Repair","value":"Motorcycle Repair"},{"label":"Motorcycle Transport","value":"Motorcycle Transport"},{"label":"Movie Tapes & DVDs","value":"Movie Tapes & DVDs"},{"label":"Music Discs & Tapes","value":"Music Discs & Tapes"},{"label":"Musical Instruments","value":"Musical Instruments"},{"label":"Musical Performance","value":"Musical Performance"},{"label":"Natural Medicines","value":"Natural Medicines"},{"label":"Office Supplies","value":"Office Supplies"},{"label":"Paper Sales","value":"Paper Sales"},{"label":"Party Supplies","value":"Party Supplies"},{"label":"Patchwork","value":"Patchwork"},{"label":"Perfumes","value":"Perfumes"},{"label":"Personal Housing Expenses","value":"Personal Housing Expenses"},{"label":"Personal Medical Expenses","value":"Personal Medical Expenses"},{"label":"Personal Products Sales","value":"Personal Products Sales"},{"label":"Personal Purchases","value":"Personal Purchases"},{"label":"Pharmacy","value":"Pharmacy"},{"label":"Phone Accessories","value":"Phone Accessories"},{"label":"Phone Repair","value":"Phone Repair"},{"label":"Phone Use Sales","value":"Phone Use Sales"},{"label":"Photography","value":"Photography"},{"label":"Pigs","value":"Pigs"},{"label":"Plastics Sales","value":"Plastics Sales"},{"label":"Poultry","value":"Poultry"},{"label":"Primary/secondary school costs","value":"Primary/secondary school costs"},{"label":"Printing","value":"Printing"},{"label":"Property","value":"Property"},{"label":"Pub","value":"Pub"},{"label":"Quarrying","value":"Quarrying"},{"label":"Recycled Materials","value":"Recycled Materials"},{"label":"Recycling","value":"Recycling"},{"label":"Religious Articles","value":"Religious Articles"},{"label":"Renewable Energy Products","value":"Renewable Energy Products"},{"label":"Restaurant","value":"Restaurant"},{"label":"Retail","value":"Retail"},{"label":"Rickshaw","value":"Rickshaw"},{"label":"Secretarial Services","value":"Secretarial Services"},{"label":"Services","value":"Services"},{"label":"Sewing","value":"Sewing"},{"label":"Shoe Sales","value":"Shoe Sales"},{"label":"Soft Drinks","value":"Soft Drinks"},{"label":"Souvenir Sales","value":"Souvenir Sales"},{"label":"Spare Parts","value":"Spare Parts"},{"label":"Sporting Good Sales","value":"Sporting Good Sales"},{"label":"Tailoring","value":"Tailoring"},{"label":"Taxi","value":"Taxi"},{"label":"Textiles","value":"Textiles"},{"label":"Timber Sales","value":"Timber Sales"},{"label":"Tourism","value":"Tourism"},{"label":"Transportation","value":"Transportation"},{"label":"Traveling Sales","value":"Traveling Sales"},{"label":"Upholstery","value":"Upholstery"},{"label":"Used Clothing","value":"Used Clothing"},{"label":"Used Shoes","value":"Used Shoes"},{"label":"Utilities","value":"Utilities"},{"label":"Vehicle","value":"Vehicle"},{"label":"Vehicle Repairs","value":"Vehicle Repairs"},{"label":"Veterinary Sales","value":"Veterinary Sales"},{"label":"Waste Management","value":"Waste Management"},{"label":"Water Distribution","value":"Water Distribution"},{"label":"Weaving","value":"Weaving"},{"label":"Wedding Expenses","value":"Wedding Expenses"},{"label":"Well digging","value":"Well digging"},{"label":"Wholesale","value":"Wholesale"}]}
        this.options.tags = {label: 'Tags', canAll: true, allAnyNone: true, multi: true, select_options: [{"value":"user_favorite","label":"User Favorite"},{"value":"volunteer_like","label":"Volunteer Like"},{"value":"volunteer_pick","label":"Volunteer Pick"},{"value":"#Animals","label":"#Animals"},{"value":"#Eco-friendly","label":"#Eco-friendly"},{"value":"#Elderly","label":"#Elderly"},{"value":"#Fabrics","label":"#Fabrics"},{"value":"#FemaleEducation","label":"#FemaleEducation"},{"value":"#FirstLoan","label":"#FirstLoan"},{"value":"#HealthAndSanitation","label":"#HealthAndSanitation"},{"value":"#IncomeProducingDurableAsset","label":"#IncomeProducingDurableAsset"},{"value":"#InspiringStory","label":"#InspiringStory"},{"value":"#InterestingPhoto","label":"#InterestingPhoto"},{"value":"#JobCreator","label":"#JobCreator"},{"value":"#Low-profitFP","label":"#Low-profitFP"},{"value":"#Orphan","label":"#Orphan"},{"value":"#Parent","label":"#Parent"},{"value":"#Refugee","label":"#Refugee"},{"value":"#RepeatBorrower","label":"#RepeatBorrower"},{"value":"#Schooling","label":"#Schooling"},{"value":"#Single","label":"#Single"},{"value":"#SingleParent","label":"#SingleParent"},{"value":"#SupportingFamily","label":"#SupportingFamily"},{"value":"#SustainableAg","label":"#SustainableAg"},{"value":"#Technology","label":"#Technology"},{"value":"#Trees","label":"#Trees"},{"value":"#Unique","label":"#Unique"},{"value":"#Vegan","label":"#Vegan"},{"value":"#Widowed","label":"#Widowed"},{"value":"#WomanOwnedBiz","label":"#WomanOwnedBiz"}]}
        this.options.themes = {label: 'Themes', canAll: true, allAnyNone: true, multi: true, select_options: [{"value":"Green","label":"Green"},{"value":"Higher Education","label":"Higher Education"},{"value":"Arab Youth","label":"Arab Youth"},{"value":"Kiva City LA","label":"Kiva City LA"},{"value":"Islamic Finance","label":"Islamic Finance"},{"value":"Youth","label":"Youth"},{"value":"Start-Up","label":"Start-Up"},{"value":"Water and Sanitation","label":"Water and Sanitation"},{"value":"Vulnerable Groups","label":"Vulnerable Groups"},{"value":"Fair Trade","label":"Fair Trade"},{"value":"Rural Exclusion","label":"Rural Exclusion"},{"value":"Mobile Technology","label":"Mobile Technology"},{"value":"Underfunded Areas","label":"Underfunded Areas"},{"value":"Conflict Zones","label":"Conflict Zones"},{"value":"Job Creation","label":"Job Creation"},{"value":"SME","label":"Small and Medium Enterprises"},{"value":"Growing Businesses","label":"Growing Businesses"},{"value":"Kiva City Detroit","label":"Kiva City Detroit"},{"value":"Health","label":"Health"},{"value":"Disaster recovery","label":"Disaster recovery"},{"value":"Flexible Credit Study","label":"Flexible Credit Study"},{"value":"Innovative Loans","label":"Innovative Loans"}].orderBy(c => c.label)}
        this.options.currency_exchange_loss_liability = {label: "Currency Loss", multi: false, select_options:[{value: '', label:"Show All"}, {value:'shared', label:"Shared Loss"},{value:'none', label:"No Currency Exchange Loss"}]}
        this.options.bonus_credit_eligibility = {label: "Bonus Credit", multi: false, select_options:[{value: '', label:"Show All"}, {value:'true', label:"Only loans eligible"},{value:'false', label:"Only loans NOT eligible"}]}
        this.options.repayment_interval = {label: "Repayment Interval", multi: true, select_options:[{value:'Monthly', label:"Monthly"},{value:"Irregularly", label:"Irregularly"},{value:"At end of term", label:"At end of term"}]}
        this.options.sort = {label: 'Sort', multi: false, select_options: [{"value": null, label: "Date half is paid back, then 75%, then full (default)"},{value: "final_repayment", label: "Final repayment date"},{value:'newest',label:'Newest'},{value:'expiring',label:'Expiring'},{value:'popularity',label:'Popularity ($/hour)'},{value: 'still_needed', label: "$ Still Needed"}]}

        //partner selects
        this.options.social_performance = {label: 'Social Performance', allAnyNone: true, canAll: true, multi: true, intArray:true, select_options: [{"value":'1',"label":"Anti-Poverty Focus"},{"value":'3',"label":"Client Voice"},{"value":'5',"label":"Entrepreneurial Support"},{"value":'6',"label":"Facilitation of Savings"},{"value":'4',"label":"Family and Community Empowerment"},{"value":'7',"label":"Innovation"},{"value":'2',"label":"Vulnerable Group Focus"}]}
        this.options.region = {label: 'Region', allAnyNone: true, multi: true, select_options: [{"value":"na","label":"North America"},{"value":"ca","label":"Central America"},{"value":"sa","label":"South America"},{"value":"af","label":"Africa"},{"value":"as","label":"Asia"},{"value":"me","label":"Middle East"},{"value":"ee","label":"Eastern Europe"},{"value":"oc","label":"Oceania"},{"value":"we","label":"Western Europe"}]} //{"value":"an","label":"Antarctica"},
        this.options.partners = {label: "Partners", allAnyNone: true, multi: true, intArray:true, select_options: []}
        this.options.charges_fees_and_interest = {label: "Charges Interest",  multi: false, select_options:[{value: '', label:"Show All"}, {value:'true', label:"Only partners that charge fees & interest"},{value:'false', label:"Only partners that do NOT charge fees & interest"}]}

        //portfolio selects
        this.options.exclude_portfolio_loans = {label: "Exclude My Loans", multi: false, select_options:[{value:'true', label:"Yes, Exclude Loans I've Made"},{value:'false', label:"No, Include Loans I've Made"}]} //,{value:"only", label:"Only Show My Fundraising Loans"}

        //balancing
        this.options.pb_partner  = {label: "Partners", key: 'id', slice_by: 'partner'}
        this.options.pb_country  = {label: "Countries", slice_by: 'country'}
        this.options.pb_region   = {label: "Regions", slice_by: 'region'}
        this.options.pb_sector   = {label: "Sectors", slice_by: 'sector'}
        this.options.pb_activity = {label: "Activites", slice_by: 'activity'}

        //loan sliders
        this.options.repaid_in = {min: 2, max: 90, label: 'Repaid In (months)', helpText: "The number of months between today and the final scheduled repayment. Kiva's sort by repayment terms, which is how many months the borrower has to pay back, creates sorting and filtering issues due to when the loan was posted and the disbursal date. KivaLens just looks at the final scheduled repayment date relative to today."}
        this.options.borrower_count = {min: 1, max: 20, label: 'Borrower Count', helpText: "The number of borrowers included in the loan. To see only individual loans, set the max to 1. To see only group loans, set the min to 2 and the max at the far right."}
        this.options.percent_female = {min: 0, max: 100, label: 'Percent Female', helpText: "What percentage of the borrowers are female. For individual borrowers, the loan will either be 0% or 100%. On Kiva, a group is considered 'Female' if more than half of the members are women. So you can set the lower bound to 50% and the upper to 100% to mimic that behavior. Additionally, you could look for groups that are 100% female, or set the lower to 40% and upper to 60% to find groups that are about evenly mixed."}
        this.options.still_needed = {min: 0, max: 1000, step: 25, label: 'Still Needed ($)', helpText: "How much is still needed to fully fund the loan. Loan Amount - Funded Amount - Basket Amount. Set the lower bound to $25 to exclude loans that are fully funded with basket amounts. Set both the lower and upper bound to $25 to find loans where they just need one more lender."} //min: 25? otherwise it bounces back to 25 if set to min
        this.options.percent_funded = {min: 0, max: 100, step: 1, label: 'Funded (%)', helpText: "What percent of the loan has already been funded (includes amounts in baskets)"}
        this.options.expiring_in_days = {min: 0, max: 35, label: 'Expiring In (days)', helpText: "The number of days left before the loan expires if not funded"}
        this.options.disbursal_in_days = {min: -90, max: 90, label: 'Disbursal (days)', helpText: "Relative to today, when does the borrower get the money? Negative days mean the borrower already has the money and the Kiva loan is used to back-fill the loan from the MFI rather than making the borrower wait for fundraising. Positive days mean the borrower does not yet have the money."}

        //partner sliders
        this.options.partner_risk_rating = {min: 0, max: 5, step: 0.5, label: 'Risk Rating (stars)', helpText: "5 star means that Kiva has estimated that the institution servicing the loan has very low probability of collapse. 1 star means they may be new and untested. To include unrated partners, have the left-most slider all the way at left."}
        this.options.partner_arrears = {min: 0, max: 50, step: 0.1, label: 'Delinq Rate (%)', helpText: "Kiva defines the Delinquency (Arrears) Rate as the amount of late payments divided by the total outstanding principal balance Kiva has with the Field Partner. Arrears can result from late repayments from Kiva borrowers as well as delayed payments from the Field Partner.  How this is calculated: Delinquency (Arrears) Rate = Amount of Paying Back Loans Delinquent / Amount Outstanding"}
        this.options.partner_default = {min: 0, max: 30, step: 0.1, label: 'Default Rate (%)', helpText: "The default rate is the percentage of ended loans (no longer paying back) which have failed to repay (measured in dollar volume, not units). How this is calculated: Default Rate = Amount of Ended Loans Defaulted / Amount of Ended Loans. For more information, please refer to Kiva's Help Center. "}
        this.options.portfolio_yield = {min: 0, max: 100, step: 0.1, label: 'Portfolio Yield (%)', helpText: "Although Kiva and its lenders don't charge interest or fees to borrowers, many of Kiva's Field Partners do charge borrowers in some form in order to make possible the long-term sustainability of their operations, reach and impact. See Kiva for more information on Portfolio Yield."}
        this.options.profit = {min: -100, max: 100, step: 0.1, label: 'Profit (%)', helpText: "'Return on Assets' is an indication of a Field Partner's profitability. It can also be an indicator of the long-term sustainability of an organization, as organizations consistently operating at a loss (those that have a negative return on assets) may not be able to sustain their operations over time."}
        this.options.loans_at_risk_rate = {min: 0, max: 100, label: 'Loans at Risk (%)', helpText: "The loans at risk rate refers to the percentage of Kiva loans being paid back by this Field Partner that are past due in repayment by at least 1 day. This delinquency can be due to either non-payment by Kiva borrowers or non-payment by the Field Partner itself. Loans at Risk Rate = Amount of paying back loans that are past due / Total amount of Kiva loans outstanding"}
        this.options.currency_exchange_loss_rate = {min: 0, max: 10, step: 0.1, label: 'Currency Exchange Loss (%)', helpText: "Kiva calculates the Currency Exchange Loss Rate for its Field Partners as: Amount of Currency Exchange Loss / Total Loans."}
        this.options.average_loan_size_percent_per_capita_income = {min: 0, max: 300, label: 'Average Loan/Capita Income', helpText: "The Field Partner's average loan size is expressed as a percentage of the country's gross national annual income per capita. Loans that are smaller (that is, as a lower percentage of gross national income per capita) are generally made to more economically disadvantaged populations. However, these same loans are generally more costly for the Field Partner to originate, disburse and collect."}
        this.options.secular_rating = {min: 1, max: 4, label: 'Secular Score (Atheist List)', helpText: "4 Completely secular, 3 Secular but with some religious influence (e.g. a secular MFI that partners with someone like World Vision), or it appears secular but with some uncertainty, 2 Nonsecular but loans without regard to borrower’s beliefs, 1 Nonsecular with a religious agenda."}
        this.options.social_rating = {min: 1, max: 4, label: 'Social Score (Atheist List)', helpText: "4 Excellent social initiatives - proactive social programs and efforts outside of lending. Truly outstanding social activities. 3 Good social initiatives in most areas. MFI has some formal and structured social programs. 2 Social goals but no/few initiatives (may have savings, business counseling). 1 No attention to social goals or initiatives. Typically the MFI only focuses on their own business issues (profitability etc.). They might mention social goals but it seems to be there just because it’s the right thing to say (politically correct)."}
    },
    figureNeedLender(crit){
        var por = crit.portfolio
        //if any of the balancers are present and enabled, show message that they need to have their lender id
        var needLenderID = ['pb_country','pb_partner','pb_activity','pb_sector'].any(n => por[n] && por[n].enabled)
        this.setState({needLenderID: (needLenderID && !kivaloans.lender_id)})
    },
    performSearch(){
        var criteria = this.buildCriteria()
        this.figureNeedLender(criteria)
        a.criteria.change(criteria)
    },
    buildCriteria(){
        var criteria = s.criteria.stripNullValues($.extend(true, {}, s.criteria.syncBlankCriteria(), this.state.criteria))
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
                data = loans.select(l => l.kl_tags).flatten().groupByWithCount(t => humanize(t))
                break
            case 'themes':
                data = loans.select(l => l.themes).flatten().where(t => t != undefined).groupByWithCount()
                break
            case 'currency_exchange_loss_liability':
                data = loans.groupByWithCount(l=>l.terms.loss_liability.currency_exchange)
                break
            case 'bonus_credit_eligibility':
                data = loans.groupByWithCount(l=>l.bonus_credit_eligibility)
                break
            case 'repayment_interval':
                data = loans.groupByWithCount(l=>l.terms.repayment_interval)
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
            default:
                return
        }

        data = data.orderBy(d=>d.count, basicReverseOrder)

        var config = {
            chart: {type: 'bar',
                animation: false ,
                renderTo: 'loan_options_graph'
            },
            title: {text: this.options[key].label},
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

        var newState = {helper_charts: {}}
        newState.helper_charts[group] = config
        this.setState(newState)
    },
    focusSelect(group, key){
        if ('lg' != findBootstrapEnv()) return //if we're not on a desktop

        this.last_select = {group: group, key: key}

        //do we ignore what is in the select
        var ignore_values = false

        var cg = this.state.criteria[group]

        if (cg[`${key}_all_any_none`] == 'all' || (this.options[key].canAll && !cg[`${key}_all_any_none`]))
            ignore_values = true

        var loans = ignore_values ? s.loans.syncFilterLoansLast() : this.performSearchWithout(group, key)

        this.genHelperGraphs(group, key, loans)
    },
    removeGraphs(){
        this.last_select = {}
        this.setState({helper_charts: {}})
    },
    render() {
        var cursor = Cursor.build(this).refine('criteria')
        var cLoan = cursor.refine('loan')
        var cPartner = cursor.refine('partner')
        var cPortfolio = cursor.refine('portfolio')
        var lender_loans_message = kivaloans.lender_loans_message //todo: find a better way

        return (<div>
            <Tabs animation={false} activeKey={this.state.activeTab} onSelect={this.tabSelect}>
                <If condition={location.hostname == '$$localhost'}>
                    <pre>{JSON.stringify(this.state.criteria, null, 2)}</pre>
                </If>

                <If condition={this.state.needLenderID}>
                    <Alert bsStyle="danger">The options in your criteria require your Lender ID. Go to the Options page to set it.</Alert>
                </If>

                <Tab eventKey={1} title="Borrower" className="ample-padding-top">
                    <Col lg={8}>
                        <InputRow label='Use or Description' cursor={cLoan.refine('use')}/>
                        <InputRow label='Name' cursor={cLoan.refine('name')} />

                        <For each='name' index='i' of={['country_code','sector','activity','themes','tags','repayment_interval','currency_exchange_loss_liability','bonus_credit_eligibility','sort']}>
                            <SelectRow key={i} cursor={cLoan.refine(name)} aanCursor={cLoan.refine(`${name}_all_any_none`)} options={this.options[name]} onFocus={this.focusSelect.bind(this, 'loan', name)} onBlur={this.removeGraphs}/>
                        </For>

                        <LimitResult cursor={cLoan.refine('limit_to')}/>

                        <For each='name' index='i' of={['repaid_in','borrower_count','percent_female','still_needed','percent_funded','expiring_in_days', 'disbursal_in_days']}>
                            <SliderRow key={i} cursorMin={cLoan.refine(`${name}_min`)} cursorMax={cLoan.refine(`${name}_max`)} cycle={this.state.activeTab} options={this.options[name]}/>
                        </For>
                    </Col>

                    <Col lg={4} className='visible-lg-block' id='loan_options_graph'>
                        <If condition={this.state.helper_charts.loan}>
                            <Highcharts style={{height: '800px'}} config={this.state.helper_charts.loan}/>
                        </If>
                    </Col>
                </Tab>

                <Tab eventKey={2} title="Partner" className="ample-padding-top">
                    <Col lg={8}>
                        <For each='name' index='i' of={['region','partners','social_performance','charges_fees_and_interest']}>
                            <SelectRow key={i} cursor={cPartner.refine(name)} aanCursor={cPartner.refine(`${name}_all_any_none`)}  options={this.options[name]} onFocus={this.focusSelect.bind(this, 'partner', name)} onBlur={this.removeGraphs}/>
                        </For>
                        <For each='name' index='i' of={['partner_risk_rating','partner_arrears','partner_default','portfolio_yield','profit','loans_at_risk_rate','currency_exchange_loss_rate', 'average_loan_size_percent_per_capita_income']}>
                            <SliderRow key={i} cursorMin={cPartner.refine(`${name}_min`)} cursorMax={cPartner.refine(`${name}_max`)} cycle={this.state.activeTab} options={this.options[name]}/>
                        </For>
                        <If condition={this.state.displayAtheistOptions}>
                            <For each='name' index='i' of={['secular_rating','social_rating']}>
                                <SliderRow key={`${i}_atheist`} cursorMin={cPartner.refine(`${name}_min`)} cursorMax={cPartner.refine(`${name}_max`)} cycle={this.state.activeTab} options={this.options[name]}/>
                            </For>
                        </If>
                    </Col>

                    <Col lg={4} className='visible-lg-block' id='loan_options_graph'>
                        <If condition={this.state.helper_charts.partner}>
                            <Highcharts style={{height: '600px'}} config={this.state.helper_charts.partner} />
                        </If>
                    </Col>
                </Tab>

                <Tab eventKey={3} title={`Your Portfolio${this.state.portfolioTab}`} className="ample-padding-top">
                    <Row>
                        <Col md={10}>
                            <If condition={!this.state.kiva_lender_id}>
                                <Alert bsStyle="danger">You have not yet set your Kiva Lender ID on the <Link to="options">Options</Link> page. These functions won't work until you do.</Alert>
                            </If>

                            To prevent you from accidentally lending to the same borrower twice if their loan is
                            still fundraising, just exclude those loans. {`(${lender_loans_message})`}

                            <For each='name' index='i' of={['exclude_portfolio_loans']}>
                                <SelectRow key={i} cursor={cPortfolio.refine(name)} aanCursor={cPortfolio.refine(`${name}_all_any_none`)} options={this.options[name]}
                                    onFocus={this.focusSelect.bind(this, 'portfolio', name)} onBlur={this.removeGraphs}  />
                            </For>
                        </Col>
                    </Row>
                    <Row className="ample-padding-top">
                        <Col md={10}>
                            <Panel header='Portfolio Balancing'>
                                Notes:
                                <ul>
                                    <li>
                                        The summary data that KivaLens pulls for your account is not "live" data.
                                        It should never be over 6 hours old, however. This means if you complete a
                                        bunch of loans and come back for more right away, the completed loans will
                                        not be accounted for in the balancing. Look for "Last Updated" to know how
                                        fresh the data is.
                                    </li>
                                    <li>
                                        If you plan to use Bulk Add in conjunction with the balancing tools then
                                        you may also want to look at the "Limit to top" option on the Loan criteria tab.
                                        This will prevent too many from a given Partner/Country/Sector/Activity from
                                        getting into your basket to keep your portfolio from getting lopsided.
                                    </li>
                                    <li>
                                        Fetching the data from Kiva can sometimes take a few seconds. If you don't see
                                        anything happen right away, just wait. This also applies to loading saved
                                        searches that have balancing options set.
                                    </li>
                                </ul>

                                <For each='name' index='i' of={['pb_partner', 'pb_country', 'pb_sector', 'pb_activity']}>
                                    <BalancingRow key={i} cursor={cPortfolio.refine(name)} options={this.options[name]}/>
                                </For>
                            </Panel>
                        </Col>
                    </Row>
                </Tab>
            </Tabs>
            </div>
        );
    }
})
export default CriteriaTabs