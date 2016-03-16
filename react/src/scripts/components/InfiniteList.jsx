//react-infinite-list v 0.4.5

import React from 'react';
import ReactDOM from 'react-dom';

import classnames from 'classnames';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'

var isWebkit = /WebKit/.test(navigator && navigator.userAgent || '');

function isHighDensity() {
    return ((window.matchMedia && (window.matchMedia('only screen and (min-resolution: 124dpi), only screen and (min-resolution: 1.3dppx), only screen and (min-resolution: 48.8dpcm)').matches || window.matchMedia('only screen and (-webkit-min-device-pixel-ratio: 1.3), only screen and (-o-min-device-pixel-ratio: 2.6/2), only screen and (min--moz-device-pixel-ratio: 1.3), only screen and (min-device-pixel-ratio: 1.3)').matches)) || (window.devicePixelRatio && window.devicePixelRatio > 1.3));
}

class LoadingListItem extends React.Component {
    render() {
        return (
            <div key={this.props.id} className="infinite-list-item item-loading">
                Loading...
            </div>
        );
    }
}

class InfiniteListItem extends React.Component {
    render() {
        return (
            <div key={this.props.id} className="infinite-list-item">
                {this.props.title}
            </div>
        );
    }
}

InfiniteListItem.propTypes = {
    title: React.PropTypes.string.isRequired,
    id: React.PropTypes.oneOfType([
        React.PropTypes.number,
        React.PropTypes.string
    ]).isRequired
};

export default class InfiniteList extends React.Component {
    constructor(props) {
        super(props);

        this._scrollTimer = null;
        this.state = { renderedStart: 0 };
    }

    onWheel() {
        this._scrolledByWheel = true;
    }

    onScroll(e) {
        e.stopPropagation();

        // webkit when scrolling by wheel
        if (isWebkit && this._scrolledByWheel && !isHighDensity()) {
            this._scrolledByWheel = false;

            if (!this._scrollTimer) {
                this._scrollTimer = setTimeout(function() {
                    this._scrollTimer = null;
                    this._calculateVisibleItems();
                }.bind(this), 150);
            }

            return;
        }

        this._calculateVisibleItems();
    }

    _calculateVisibleItems() {
        var scrolledPx = this.refs.infiniteList.scrollTop;

        var visibleStart = Math.floor(scrolledPx / this.props.itemHeight);

        if (visibleStart !== this.state.renderedStart) {
            this.setState({ renderedStart: visibleStart });
        }
    }

    componentWillReceiveProps(nextProps) {
        var itemsChanged  = this.props.items.length !== nextProps.items.length,
            heightChanged = this.props.height !== nextProps.height;

        if (itemsChanged || heightChanged) {
            this._calculateVisibleItems();
        }
    }

    _getItemComponent(item, i) {
        let ListItemComponent = this.props.listItemClass;

        if (this.props.isItemLoading(item)) {
            ListItemComponent = this.props.loadingListItemClass;
        }

        let key = item ? item.id : i;

        return <ListItemComponent key={key} {...item} />;
    }

    _getClassNames() {
        return classnames(
            'infinite-list',
            this.props.className
        );
    }

    componentDidMount() {
        this.state.isInitialRender = false;

        setTimeout(() => {
            if (this.refs.infiniteList) {
                this.refs.infiniteList.scrollTop = this.props.firstVisibleItemIndex * this.props.itemHeight;
            }
        }, 0);
    }

    _getVisibleSlice(items, start, end) {
        let result = [];

        for (let i = start; i < end; i++) {
            result.push(items[i]);
        }

        return result;
    }

    _prepareVisibleItems(itemsPerPage) {
        let visibleStart = this.state.renderedStart,
            visibleEnd = Math.min(this.props.itemsCount, visibleStart + itemsPerPage);

        let visibleItems = this._getVisibleSlice(this.props.items, visibleStart, visibleEnd);

        //any is in linq
        if (this.props.paging && visibleItems.any(this.props.isItemLoading)) {
            this.props.onRangeChange(visibleStart, visibleEnd);
        }

        return visibleItems;
    }

    _getContentStyle(itemsPerPage) {
        var { itemHeight } = this.props;

        // the number one guarantees there is never empty space at the end of the list
        var totalHeight = this.props.itemsCount * itemHeight,
            pageHeight = itemsPerPage * itemHeight;

        // if maximum number of items on page is larger than actual number of items, maxPadding can be < 0
        var maxPadding = Math.max(0, totalHeight - pageHeight + itemHeight),
            padding = this.state.renderedStart * this.props.itemHeight,
            paddingTop = Math.min(maxPadding, padding);

        return {
            height: totalHeight - paddingTop,
            paddingTop: paddingTop
        };
    }

    render() {
        let itemsPerPage = Math.ceil(this.props.height / this.props.itemHeight) + 1;

        let visibleItems = this._prepareVisibleItems(itemsPerPage);
        let itemComponents = visibleItems.map(this._getItemComponent, this);
        let contentStyle = this._getContentStyle(itemsPerPage);

        return (
            <div ref="infiniteList"
                className={this._getClassNames()}
                onWheel={this.onWheel.bind(this)}
                onScroll={this.onScroll.bind(this)}
                style={{height: this.props.height}}>
                <div className="infinite-list-content" style={contentStyle}>
                    {itemComponents}
                </div>
            </div>
        );
    }
}

/**
 *
 *

 <ReactCSSTransitionGroup
 component="div"
 className="infinite-list-content"
 style={contentStyle}
 transitionName="cards"
 transitionEnterTimeout={500}>
 {itemComponents}
 </ReactCSSTransitionGroup>
 *
 * <ReactCSSTransitionGroup
 component="div"
 className="infinite-list-content"
 style={contentStyle}
 transitionName="cards"
 transitionEnterTimeout={500}
 transitionLeaveTimeout={300}>
 {itemComponents}
 </ReactCSSTransitionGroup>
 *
 */

InfiniteList.propTypes = {
    items: React.PropTypes.array.isRequired,
    height: React.PropTypes.number.isRequired,
    itemHeight: React.PropTypes.number.isRequired,
    isItemLoading: React.PropTypes.func,
    listItemClass: React.PropTypes.func,
    loadingListItemClass: React.PropTypes.func,
    firstVisibleItemIndex: React.PropTypes.number,
    paging: React.PropTypes.bool,
    itemsCount: React.PropTypes.number.isRequired

};

InfiniteList.defaultProps = {
    firstVisibleItemIndex: 0,
    isItemLoading: () => false,
    paging: false,
    listItemClass: InfiniteListItem,
    lodingListItemClass: LoadingListItem
};