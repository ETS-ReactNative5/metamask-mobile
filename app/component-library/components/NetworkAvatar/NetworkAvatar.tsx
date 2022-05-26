/* eslint-disable react/prop-types */
import React from 'react';
import { Image } from 'react-native';
import JazzIcon from 'react-native-jazzicon';
import { toDataUrl } from '../../../util/blockies';
import BaseAvatar from '../BaseAvatar';
import stylesheet from './NetworkAvatar.styles';
import { AccountAvatarProps, AccountAvatarType } from './NetworkAvatar.types';

const NetworkAvatar = ({
  chainId,
  size,
  style,
}: AccountAvatarProps) => (
  <BaseAvatar size={size} style={style}>
    {
      {
        [AccountAvatarType.JazzIcon]: (
          <JazzIcon size={Number(size)} address={accountAddress} />
        ),
        [AccountAvatarType.Blockies]: (
          <Image
            source={{ uri: toDataUrl(accountAddress) }}
            style={stylesheet.imageStyle}
          />
        ),
      }[type]
    }
  </BaseAvatar>
);

export default AccountAvatar;

export { AccountAvatar };
