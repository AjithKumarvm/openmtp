'use strict';

/*  eslint-disable react/destructuring-assignment */

import React, { PureComponent } from 'react';
import { withStyles } from '@material-ui/core/styles';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import FileExplorerTableGridRender from './FileExplorerTableBodyGridRender';
import { quickHash } from '../../../utils/funcs';
import { styles } from '../styles/FileExplorerTableBodyGridWrapperRender';

class FileExplorerTableBodyGridWrapperRender extends PureComponent {
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
    const { classes: styles, isSelected, ...parentProps } = this.props;

    return (
      <TableRow>
        <TableCell colSpan={6} className={styles.gridTableCell}>
          <div className={styles.wrapper}>
            {this.state.items.map(item => {
              return (
                <FileExplorerTableGridRender
                  key={quickHash(item.path)}
                  item={item}
                  isSelected={isSelected(item.path)}
                  {...parentProps}
                />
              );
            })}
          </div>
        </TableCell>
      </TableRow>
    );
  }
}

export default withStyles(styles)(FileExplorerTableBodyGridWrapperRender);
