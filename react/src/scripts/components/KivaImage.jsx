'use strict'
import React from 'react'
import cx from 'classnames'

const KivaImage = React.createClass({
    getInitialState(){
        return {loaded: false}
    },
    getDefaultProps(){
        return {type: 'width'}
    },
    componentWillReceiveProps({loan,image_id}){
        //if (loan != this.props.loan || image_id != this.props.image_id)
        //    this.setState({loaded: false})
    },
    imageLoaded(){
        this.setState({loaded:true})
    },
    render(){
        //anon: http://www.kiva.org/img/w800/726677.jpg
        //if loan={loan} is set to a valid API loan object, it knows how to get the image id
        var image_id = (this.props.loan) ? this.props.loan.image.id : this.props.image_id
        let {loaded} = this.state
        //set width if width is not defined (?)
        if (this.props.image_width && !this.props.width){
            this.props.width = this.props.image_width
        }

        var alt_text = (this.props.loan) ? this.props.loan.name : ''

        //supports 'square' type else it defaults to 'width'
        var image_dir = (this.props.type == 'square') ? `s${this.props.image_width}` : `w${this.props.image_width}`

        //build the URL
        var image_url = `https://www.kiva.org/img/${image_dir}/${image_id}.jpg`
        if (this.props.useThumbAsBackground)
            var loading_image_url = `https://www.kiva.org/img/s113/${image_id}.jpg`
        else
            loading_image_url = `https://www.kiva.org/img/${image_dir}/726677.jpg`

        var style = !loaded ? {backgroundImage:`url("${loading_image_url}")`} : {}

        //width:this.props.width,height:this.props.height,
        return <div className={cx("KivaImage",{loaded,'not_loaded':!loaded})} style={style}>
                <div className="loading_notice">Larger version loading...</div>
                <img width={this.props.width} height={this.props.height} onLoad={this.imageLoaded} alt={alt_text} src={image_url}/>
            </div>

        //return (<img {...this.props} alt={alt_text} src={image_url} />)
    }
})

//optionally wrap it in a link? not exported at this time.
const KivaThumbnail = React.createClass({
    render(){
        return (<KivaImage image_width={113} {...this.props}/>)
    }
})

export default KivaImage;