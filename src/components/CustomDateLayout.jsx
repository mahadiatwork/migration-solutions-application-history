import * as React from 'react';
import { Dayjs } from 'dayjs';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import {
  PickersLayoutProps,
  usePickerLayout,
  pickersLayoutClasses,
  PickersLayoutRoot,
  PickersLayoutContentWrapper,
} from '@mui/x-date-pickers/PickersLayout';
import { DateView } from '@mui/x-date-pickers/models';

export default function CustomLayout(props) {
    const { toolbar, tabs, content, actionBar } = usePickerLayout(props);
  
    return (
      <PickersLayoutRoot
        ownerState={props}
        sx={{
          overflow: 'auto',
          [`.${pickersLayoutClasses.actionBar}`]: {
            gridColumn: 1,
            gridRow: 2,
          },
          [`.${pickersLayoutClasses.toolbar}`]: {
            gridColumn: 2,
            gridRow: 1,
          },
        }}
      >
        {toolbar}
        {actionBar}
        <PickersLayoutContentWrapper className={pickersLayoutClasses.contentWrapper}>
          {tabs}
          {content}
        </PickersLayoutContentWrapper>
      </PickersLayoutRoot>
    );
  }