'use strict';

import React, { PureComponent } from 'react';
import FileExplorerTableRowsRender from './FileExplorerTableBodyListRender';
import { quickHash } from '../../../utils/funcs';

/*  eslint-disable react/destructuring-assignment */

export default class FileExplorerTableBodyListWrapperRender extends PureComponent {
  constructor(props) {
    super(props);

    this.recursiveFilesFetchTimeOut = null;
    this.filesPreFetchCount = 50;
    this.state = {
      items: this.props.tableSort.slice(0, this.filesPreFetchCount)
    };

    this._isMounted = false;
  }

  componentDidMount() {
    this._isMounted = true;
    this.recursiveFilesFetch();
  }

  componentWillUpdate(prevProps) {
    if (
      JSON.stringify(prevProps.tableSort) ===
      JSON.stringify(this.props.tableSort)
    ) {
      return null;
    }

    this.recursiveFilesFetch();
  }

  componentWillUnmount() {
    this.clearRecursiveFilesFetchTimeOut();
  }

  recursiveFilesFetch = () => {
    if (!this._isMounted) {
      return null;
    }

    if (this.props.tableSort.length < 1) {
      this.state = {
        items: this.props.tableSort
      };

      return null;
    }

    this.recursiveFilesFetchTimeOut = setTimeout(() => {
      const hasMore = this.state.items.length + 1 < this.props.tableSort.length;

      this.setState((prev, props) => ({
        items: props.tableSort.slice(
          0,
          prev.items.length + this.filesPreFetchCount
        )
      }));

      if (hasMore) {
        this.recursiveFilesFetch();
      } else {
        this.clearRecursiveFilesFetchTimeOut();
        return null;
      }
    }, 0);
  };

  clearRecursiveFilesFetchTimeOut() {
    if (this.recursiveFilesFetchTimeOut) {
      clearTimeout(this.recursiveFilesFetchTimeOut);
      this.recursiveFilesFetchTimeOut = null;
    }
  }

  render() {
    const { isSelected, ...parentProps } = this.props;

    return this.state.items.map(item => {
      return (
        <FileExplorerTableRowsRender
          key={quickHash(item.path)}
          item={item}
          isSelected={isSelected(item.path)}
          {...parentProps}
        />
      );
    });
  }
}
