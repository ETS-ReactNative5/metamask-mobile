/* eslint-disable */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Alert, TouchableOpacity, View, Image, StyleSheet, Text, ScrollView, InteractionManager } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/core';
import Share from 'react-native-share';
import Icon from 'react-native-vector-icons/FontAwesome';
import FeatherIcon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, fontStyles } from '../../../styles/common';
import { hasBlockExplorer, findBlockExplorerForRpc, getBlockExplorerName } from '../../../util/networks';
import Identicon from '../Identicon';
import StyledButton from '../StyledButton';
import AccountList from '../AccountList';
import NetworkList from '../NetworkList';
import { renderFromWei, renderFiat } from '../../../util/number';
import { strings } from '../../../../locales/i18n';
import { DrawerActions } from '@react-navigation/native';
import Modal from 'react-native-modal';
import SecureKeychain from '../../../core/SecureKeychain';
import {
	toggleNetworkModal as importedToggleNetworkModal,
	toggleAccountsModal as importedToggleAccountsModal,
	toggleReceiveModal as importedToggleReceiveModal,
} from '../../../actions/modals';
import { showAlert as importedShowAlert } from '../../../actions/alert';
import { getEtherscanAddressUrl, getEtherscanBaseUrl } from '../../../util/etherscan';
import Engine from '../../../core/Engine';
import Logger from '../../../util/Logger';
// import PropTypes from 'prop-types';
// import Device from '../../../util/device';
// import DeeplinkManager from '../../../core/DeeplinkManager';
// import AppConstants from '../../../core/AppConstants';
import OnboardingWizard from '../OnboardingWizard';
import ReceiveRequest from '../ReceiveRequest';
import Analytics from '../../../core/Analytics';
import { ANALYTICS_EVENT_OPTS } from '../../../util/analytics';
import URL from 'url-parse';
import EthereumAddress from '../EthereumAddress';
import { getEther } from '../../../util/transactions';
import { newAssetTransaction as importedNewAssetTransaction } from '../../../actions/transaction';
import { protectWalletModalVisible } from '../../../actions/user';
import SettingsNotification from '../SettingsNotification';
import WhatsNewModal from '../WhatsNewModal';
import InvalidCustomNetworkAlert from '../InvalidCustomNetworkAlert';
import { RPC } from '../../../constants/network';
import { findRouteNameFromNavigatorState } from '../../../util/general';
import AnalyticsV2, { ANALYTICS_EVENTS_V2 } from '../../../util/analyticsV2';
import { isDefaultAccountName, doENSReverseLookup } from '../../../util/ENSUtils';
import ClipboardManager from '../../../core/ClipboardManager';
import RenderCounter from '../../../core/RenderCounter';
import { Props } from './types';
import styles from './styles';

const metamask_name = require('../../../images/metamask-name.png'); // eslint-disable-line
const metamask_fox = require('../../../images/fox.png'); // eslint-disable-line
const ICON_IMAGES = {
	wallet: require('../../../images/wallet-icon.png'), // eslint-disable-line
	'selected-wallet': require('../../../images/selected-wallet-icon.png'), // eslint-disable-line
};

/**
 * View component that displays the MetaMask fox
 * in the middle of the screen
 */
const DrawerView = (props: Props) => {
	const navigation = useNavigation();
	const dispatch = useDispatch();

	const [showProtectWalletModal, setShowProtectWalletModal] = useState<any>(undefined);
	const [invalidCustomNetwork, setInvalidCustomNetwork] = useState<any>(undefined);
	const [account, setAccount] = useState({
		ens: undefined,
		name: undefined,
		address: undefined,
		currentNetwork: undefined,
	});
	const browserSectionRef = useRef(null);
	let currentBalanceRef = useRef<number | null>(null);
	let previousBalanceRef = useRef<number | null>(null);
	let [animatingNetworksModal, setAnimatingNetworksModal] = useState(false);
	let [animatingAccountsModal, setAnimatingAccountsModal] = useState(false);

	// const accounts = useSelector((state: any) =>state.engine.backgroundState.AccountTrackerController.accounts)
	// const tokens = useSelector((state: any) =>state.engine.backgroundState.TokensController.tokens)
	// const tokenBalances = useSelector((state: any) =>state.engine.backgroundState.TokenBalancesController.contractBalances)
	// const collectibles = useSelector((state: any) =>state.engine.backgroundState.CollectiblesController.collectibles)
	const network = useSelector((state: any) => state.engine.backgroundState.NetworkController);
	const selectedAddress = useSelector(
		(state: any) => state.engine.backgroundState.PreferencesController.selectedAddress
	);
	const identities = useSelector((state: any) => state.engine.backgroundState.PreferencesController.identities);
	const frequentRpcList = useSelector(
		(state: any) => state.engine.backgroundState.PreferencesController.frequentRpcList
	);
	const currentCurrency = useSelector(
		(state: any) => state.engine.backgroundState.CurrencyRateController.currentCurrency
	);
	const keyrings = useSelector((state: any) => state.engine.backgroundState.KeyringController.keyrings);
	const networkModalVisible = useSelector((state: any) => state.modals.networkModalVisible);
	const accountsModalVisible = useSelector((state: any) => state.modals.accountsModalVisible);
	const receiveModalVisible = useSelector((state: any) => state.modals.receiveModalVisible);
	const passwordSet = useSelector((state: any) => state.user.passwordSet);
	const wizard = useSelector((state: any) => state.wizard);
	const ticker = useSelector((state: any) => state.engine.backgroundState.NetworkController.provider.ticker);
	const seedphraseBackedUp = useSelector((state: any) => state.user.seedphraseBackedUp);

	const toggleNetworkModal = () => dispatch(importedToggleNetworkModal());
	const toggleAccountsModal = () => dispatch(importedToggleAccountsModal());
	const toggleReceiveModal = () => dispatch(importedToggleReceiveModal());
	const showAlert = (config: any) => dispatch(importedShowAlert(config));
	const newAssetTransaction = (selectedAsset: any) => dispatch(importedNewAssetTransaction(selectedAsset));

	const isCurrentAccountImported = () => {
		let ret = false;
		const allKeyrings = keyrings && keyrings.length ? keyrings : Engine.context.KeyringController.state.keyrings;
		for (const keyring of allKeyrings) {
			if (keyring.accounts.includes(selectedAddress)) {
				ret = keyring.type !== 'HD Key Tree';
				break;
			}
		}

		return ret;
	};

	// async componentDidUpdate() {
	// 	const route = findRouteNameFromNavigatorState(this.props.navigation.dangerouslyGetState().routes);
	// 	if (!this.props.passwordSet || !this.props.seedphraseBackedUp) {
	// 		if (
	// 			[
	// 				'SetPasswordFlow',
	// 				'ChoosePassword',
	// 				'AccountBackupStep1',
	// 				'AccountBackupStep1B',
	// 				'ManualBackupStep1',
	// 				'ManualBackupStep2',
	// 				'ManualBackupStep3',
	// 				'Webview',
	// 				'LockScreen',
	// 			].includes(route)
	// 		) {
	// 			// eslint-disable-next-line react/no-did-update-set-state
	// 			this.state.showProtectWalletModal && this.setState({ showProtectWalletModal: false });
	// 			return;
	// 		}
	// 		let tokenFound = false;

	// 		this.props.tokens.forEach((token) => {
	// 			if (this.props.tokenBalances[token.address] && !this.props.tokenBalances[token.address]?.isZero()) {
	// 				tokenFound = true;
	// 			}
	// 		});
	// 		if (
	// 			!this.props.passwordSet ||
	// 			this.currentBalance > 0 ||
	// 			tokenFound ||
	// 			this.props.collectibles.length > 0
	// 		) {
	// 			// eslint-disable-next-line react/no-did-update-set-state
	// 			this.setState({ showProtectWalletModal: true });
	// 			InteractionManager.runAfterInteractions(() => {
	// 				AnalyticsV2.trackEvent(AnalyticsV2.ANALYTICS_EVENTS.WALLET_SECURITY_PROTECT_VIEWED, {
	// 					wallet_protection_required: false,
	// 					source: 'Backup Alert',
	// 				});
	// 			});
	// 		} else {
	// 			// eslint-disable-next-line react/no-did-update-set-state
	// 			this.setState({ showProtectWalletModal: false });
	// 		}
	// 	} else {
	// 		// eslint-disable-next-line react/no-did-update-set-state
	// 		this.setState({ showProtectWalletModal: false });
	// 	}
	// 	const pendingDeeplink = DeeplinkManager.getPendingDeeplink();
	// 	const { KeyringController } = Engine.context;
	// 	if (pendingDeeplink && KeyringController.isUnlocked() && route !== 'LockScreen') {
	// 		DeeplinkManager.expireDeeplink();
	// 		DeeplinkManager.parse(pendingDeeplink, { origin: AppConstants.DEEPLINKS.ORIGIN_DEEPLINK });
	// 	}
	// 	await updateAccountInfo();
	// }

	const updateAccountInfo = useCallback(async () => {
		const { currentNetwork, address, name } = account;
		const accountName = identities[selectedAddress].name;
		if (currentNetwork !== network || address !== selectedAddress || name !== accountName) {
			const ens = await doENSReverseLookup(selectedAddress, network.provider.chainId);
			setAccount({
				ens,
				name: accountName,
				currentNetwork: network,
				address: selectedAddress,
			});
		}
	}, [account, identities, selectedAddress, network]);

	const hideDrawer = () => {
		return new Promise((resolve) => {
			navigation.dispatch(DrawerActions.closeDrawer());
			setTimeout(() => {
				resolve(null);
			}, 300);
		});
	};

	const goToBrowserUrl = useCallback(
		(url, title) => {
			navigation.navigate('Webview', {
				screen: 'SimpleWebview',
				params: {
					url,
					title,
				},
			});
			hideDrawer();
		},
		[navigation, hideDrawer]
	);

	const trackEvent = (event: any) => {
		InteractionManager.runAfterInteractions(() => {
			Analytics.trackEvent(event);
		});
	};

	const trackOpenBrowserEvent = useCallback(() => {
		AnalyticsV2.trackEvent(AnalyticsV2.ANALYTICS_EVENTS.BROWSER_OPENED, {
			referral_source: 'In-app Navigation',
			chain_id: network,
		});
	}, [network]);

	const triggerToggleAccountsModal = useCallback(() => {
		if (!animatingAccountsModal) {
			setAnimatingAccountsModal(true);
			toggleAccountsModal();
			setTimeout(() => {
				setAnimatingAccountsModal(false);
			}, 500);
		}
		!accountsModalVisible && trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_ACCOUNT_NAME);
	}, [animatingAccountsModal, setAnimatingAccountsModal, toggleAccountsModal, accountsModalVisible, trackEvent]);

	const triggerToggleNetworksModal = useCallback(() => {
		if (!animatingNetworksModal) {
			setAnimatingNetworksModal(true);
			toggleNetworkModal();
			setTimeout(() => {
				setAnimatingNetworksModal(false);
			}, 500);
		}
	}, [animatingNetworksModal, setAnimatingNetworksModal, toggleNetworkModal]);

	const onNetworksModalClose = useCallback(
		async (manualClose: boolean) => {
			triggerToggleNetworksModal();
			if (!manualClose) {
				await hideDrawer();
			}
		},
		[triggerToggleNetworksModal, hideDrawer]
	);

	const triggerToggleReceiveModal = useCallback(() => {
		toggleReceiveModal();
	}, [toggleReceiveModal]);

	const showReceiveModal = useCallback(() => {
		toggleReceiveModal();
	}, [toggleReceiveModal]);

	const onReceive = useCallback(() => {
		toggleReceiveModal();
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_RECEIVE);
	}, [toggleReceiveModal, trackEvent]);

	const onSend = useCallback(() => {
		newAssetTransaction(getEther(ticker));
		navigation.navigate('SendFlowView');
		hideDrawer();
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_SEND);
	}, [newAssetTransaction, ticker, navigation, hideDrawer, trackEvent]);

	const goToBrowser = useCallback(() => {
		navigation.navigate('BrowserTabHome');
		hideDrawer();
		trackOpenBrowserEvent();
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_BROWSER);
	}, [navigation, hideDrawer, trackOpenBrowserEvent, trackEvent]);

	const showWallet = useCallback(() => {
		navigation.navigate('WalletTabHome');
		hideDrawer();
		trackEvent(ANALYTICS_EVENTS_V2.WALLET_OPENED);
	}, [navigation, hideDrawer, trackEvent]);

	const goToTransactionHistory = useCallback(() => {
		navigation.navigate('TransactionsHome');
		hideDrawer();
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_TRANSACTION_HISTORY);
	}, [navigation, hideDrawer, trackEvent]);

	const showSettings = useCallback(() => {
		navigation.navigate('SettingsView');
		hideDrawer();
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_SETTINGS);
	}, [navigation, hideDrawer, trackEvent]);

	const onPress = useCallback(async () => {
		const { KeyringController } = Engine.context;
		await SecureKeychain.resetGenericPassword();
		await KeyringController.setLocked();
		if (!passwordSet) {
			navigation.navigate('OnboardingRootNav', {
				screen: 'OnboardingNav',
				params: { screen: 'Onboarding' },
			});
		} else {
			navigation.navigate('Login');
		}
	}, [passwordSet, navigation]);

	const logout = useCallback(() => {
		Alert.alert(
			strings('drawer.logout_title'),
			'',
			[
				{
					text: strings('drawer.logout_cancel'),
					onPress: () => null,
					style: 'cancel',
				},
				{
					text: strings('drawer.logout_ok'),
					onPress: onPress,
				},
			],
			{ cancelable: false }
		);
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_LOGOUT);
	}, [onPress, trackEvent]);

	const viewInEtherscan = useCallback(() => {
		const { rpcTarget, type } = network.provider;
		if (type === RPC) {
			const blockExplorer = findBlockExplorerForRpc(rpcTarget, frequentRpcList);
			const url = `${blockExplorer}/address/${selectedAddress}`;
			const title = new URL(blockExplorer).hostname;
			goToBrowserUrl(url, title);
		} else {
			const url = getEtherscanAddressUrl(network.provider.type, selectedAddress);
			const etherscan_url = getEtherscanBaseUrl(network.provider.type).replace('https://', '');
			goToBrowserUrl(url, etherscan_url);
		}
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_VIEW_ETHERSCAN);
	}, [network, frequentRpcList, goToBrowserUrl, trackEvent, selectedAddress]);

	const submitFeedback = useCallback(() => {
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_SEND_FEEDBACK);
		goToBrowserUrl('https://community.metamask.io/c/feature-requests-ideas/', strings('drawer.request_feature'));
	}, [trackEvent, goToBrowserUrl]);

	const showHelp = useCallback(() => {
		goToBrowserUrl('https://support.metamask.io', strings('drawer.metamask_support'));
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_GET_HELP);
	}, [goToBrowserUrl, trackEvent]);

	const onAccountChange = useCallback(() => {
		setTimeout(() => {
			toggleAccountsModal();
			hideDrawer();
		}, 300);
	}, [toggleAccountsModal, hideDrawer]);

	const onImportAccount = useCallback(() => {
		toggleAccountsModal();
		navigation.navigate('ImportPrivateKeyView');
		hideDrawer();
	}, [toggleAccountsModal, navigation, hideDrawer]);

	const triggerHasBlockExplorer = useCallback(
		(providerType: any) => {
			if (providerType === RPC) {
				const { rpcTarget } = network.provider;
				const blockExplorer = findBlockExplorerForRpc(rpcTarget, frequentRpcList);
				if (blockExplorer) {
					return true;
				}
			}
			return hasBlockExplorer(providerType);
		},
		[frequentRpcList, network]
	);

	const getIcon = (name: string, size?: number) => {
		return <Icon name={name} size={size || 24} color={colors.grey400} />;
	};

	const getFeatherIcon = (name: string, size?: number) => {
		return <FeatherIcon name={name} size={size || 24} color={colors.grey400} />;
	};

	const getMaterialIcon = (name: string, size?: number) => {
		return <MaterialIcon name={name} size={size || 24} color={colors.grey400} />;
	};

	const getImageIcon = (name: string) => {
		return <Image source={(ICON_IMAGES as any)[name]} style={styles.menuItemIconImage} />;
	};

	const getSelectedIcon = (name: string, size?: number) => {
		return <Icon name={name} size={size || 24} color={colors.blue} />;
	};

	const getSelectedFeatherIcon = (name: string, size?: number) => {
		return <FeatherIcon name={name} size={size || 24} color={colors.blue} />;
	};

	const getSelectedMaterialIcon = (name: string, size?: number) => {
		return <MaterialIcon name={name} size={size || 24} color={colors.blue} />;
	};

	const getSelectedImageIcon = (name: string) => {
		return <Image source={(ICON_IMAGES as any)[`selected-${name}`]} style={styles.menuItemIconImage} />;
	};

	const onShare = useCallback(() => {
		Share.open({
			message: selectedAddress,
		})
			.then(() => {
				protectWalletModalVisible();
			})
			.catch((err) => {
				Logger.log('Error while trying to share address', err);
			});
		trackEvent(ANALYTICS_EVENT_OPTS.NAVIGATION_TAPS_SHARE_PUBLIC_ADDRESS);
	}, [selectedAddress, trackEvent, protectWalletModalVisible]);

	const getSections = useCallback(() => {
		const { type, rpcTarget } = network;
		let blockExplorer, blockExplorerName;
		if (type === RPC) {
			blockExplorer = findBlockExplorerForRpc(rpcTarget, frequentRpcList);
			blockExplorerName = getBlockExplorerName(blockExplorer);
		}
		return [
			[
				{
					name: strings('drawer.browser'),
					icon: getIcon('globe'),
					selectedIcon: getSelectedIcon('globe'),
					action: goToBrowser,
					routeNames: ['BrowserView', 'AddBookmark'],
				},
				{
					name: strings('drawer.wallet'),
					icon: getImageIcon('wallet'),
					selectedIcon: getSelectedImageIcon('wallet'),
					action: showWallet,
					routeNames: ['WalletView', 'Asset', 'AddAsset', 'Collectible'],
				},
				{
					name: strings('drawer.transaction_history'),
					icon: getFeatherIcon('list'),
					selectedIcon: getSelectedFeatherIcon('list'),
					action: goToTransactionHistory,
					routeNames: ['TransactionsView'],
				},
			],
			[
				{
					name: strings('drawer.share_address'),
					icon: getMaterialIcon('share-variant'),
					action: onShare,
				},
				{
					name:
						(blockExplorer && `${strings('drawer.view_in')} ${blockExplorerName}`) ||
						strings('drawer.view_in_etherscan'),
					icon: getIcon('eye'),
					action: viewInEtherscan,
				},
			],
			[
				{
					name: strings('drawer.settings'),
					icon: getFeatherIcon('settings'),
					warning: strings('drawer.settings_warning_short'),
					action: showSettings,
				},
				{
					name: strings('drawer.help'),
					icon: getFeatherIcon('help-circle'),
					action: showHelp,
				},
				{
					name: strings('drawer.request_feature'),
					icon: getFeatherIcon('message-square'),
					action: submitFeedback,
				},
				{
					name: strings('drawer.logout'),
					icon: getFeatherIcon('log-out'),
					action: logout,
				},
			],
		];
	}, [
		network,
		frequentRpcList,
		getIcon,
		getSelectedIcon,
		goToBrowser,
		viewInEtherscan,
		showSettings,
		showHelp,
		submitFeedback,
		logout,
		goToTransactionHistory,
		getImageIcon,
		getSelectedImageIcon,
		showWallet,
		getFeatherIcon,
		getSelectedFeatherIcon,
		getMaterialIcon,
		getSelectedMaterialIcon,
		onShare,
	]);

	const copyAccountToClipboard = useCallback(async () => {
		await ClipboardManager.setString(selectedAddress);
		toggleReceiveModal();
		InteractionManager.runAfterInteractions(() => {
			showAlert({
				isVisible: true,
				autodismiss: 1500,
				content: 'clipboard-alert',
				data: { msg: strings('account_details.account_copied_to_clipboard') },
			});
		});
	}, [selectedAddress, toggleReceiveModal, showAlert]);

	const closeInvalidCustomNetworkAlert = () => {
		setInvalidCustomNetwork(null);
	};

	const showInvalidCustomNetworkAlert = (network: any) => {
		InteractionManager.runAfterInteractions(() => {
			setInvalidCustomNetwork(network);
		});
	};

	/**
	 * Return step 5 of onboarding wizard if that is the current step
	 */
	const renderOnboardingWizard = useCallback(() => {
		const { step } = wizard;
		return step === 5 && <OnboardingWizard navigation={navigation} coachmarkRef={browserSectionRef} />;
	}, [navigation]);

	const onSecureWalletModalAction = useCallback(() => {
		setShowProtectWalletModal(false);
		navigation.navigate('SetPasswordFlow', passwordSet ? { screen: 'AccountBackupStep1' } : undefined);
		InteractionManager.runAfterInteractions(() => {
			AnalyticsV2.trackEvent(AnalyticsV2.ANALYTICS_EVENTS.WALLET_SECURITY_PROTECT_ENGAGED, {
				wallet_protection_required: true,
				source: 'Modal',
			});
		});
	}, [setShowProtectWalletModal, navigation, passwordSet]);

	const renderProtectModal = useCallback(
		() => (
			<Modal
				isVisible={showProtectWalletModal}
				animationIn="slideInUp"
				animationOut="slideOutDown"
				style={styles.bottomModal}
				backdropOpacity={0.7}
				animationInTiming={600}
				animationOutTiming={600}
			>
				<View style={styles.protectWalletContainer}>
					<View style={styles.protectWalletIconContainer}>
						<FeatherIcon style={styles.protectWalletIcon} name="alert-triangle" size={20} />
					</View>
					<Text style={styles.protectWalletTitle}>{strings('protect_your_wallet_modal.title')}</Text>
					<Text style={styles.protectWalletContent}>
						{!passwordSet
							? strings('protect_your_wallet_modal.body_for_password')
							: strings('protect_your_wallet_modal.body_for_seedphrase')}
					</Text>
					<View style={styles.protectWalletButtonWrapper}>
						<StyledButton type={'confirm'} onPress={onSecureWalletModalAction}>
							{strings('protect_your_wallet_modal.button')}
						</StyledButton>
					</View>
				</View>
			</Modal>
		),
		[showProtectWalletModal, passwordSet, onSecureWalletModalAction]
	);

	RenderCounter.recordRender('Drawer');

	const { name, ens } = account;
	// const constructedAccount = { address: selectedAddress, ...identities[selectedAddress], ...accounts[selectedAddress] };
	// constructedAccount.balance = (accounts[selectedAddress] && renderFromWei(accounts[selectedAddress].balance)) || 0;
	const fiatBalance = Engine.getTotalFiatAccountBalance();
	if (fiatBalance !== previousBalanceRef.current) {
		previousBalanceRef.current = currentBalanceRef.current;
	}
	currentBalanceRef.current = fiatBalance;
	const fiatBalanceStr = renderFiat(currentBalanceRef.current, currentCurrency);
	const currentRoute = findRouteNameFromNavigatorState(navigation.dangerouslyGetState().routes);
	return (
		<View style={styles.wrapper} testID={'drawer-screen'}>
			<ScrollView>
				<View style={styles.header}>
					<View style={styles.metamaskLogo}>
						<Image source={metamask_fox} style={styles.metamaskFox} resizeMethod={'auto'} />
						<Image source={metamask_name} style={styles.metamaskName} resizeMethod={'auto'} />
					</View>
				</View>
				<View style={styles.account}>
					<View style={styles.accountBgOverlay}>
						<TouchableOpacity
							style={styles.identiconWrapper}
							onPress={triggerToggleAccountsModal}
							testID={'navbar-account-identicon'}
						>
							<View style={styles.identiconBorder}>
								<Identicon diameter={48} address={selectedAddress} />
							</View>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.accountInfo}
							onPress={triggerToggleAccountsModal}
							testID={'navbar-account-button'}
						>
							<View style={styles.accountNameWrapper}>
								<Text style={styles.accountName} numberOfLines={1}>
									{isDefaultAccountName(name) && ens ? ens : name}
								</Text>
								<Icon name="caret-down" size={24} style={styles.caretDown} />
							</View>
							<Text style={styles.accountBalance}>{fiatBalanceStr}</Text>
							<EthereumAddress address={selectedAddress} style={styles.accountAddress} type={'short'} />
							{isCurrentAccountImported() && (
								<View style={styles.importedWrapper}>
									<Text numberOfLines={1} style={styles.importedText}>
										{strings('accounts.imported')}
									</Text>
								</View>
							)}
						</TouchableOpacity>
					</View>
				</View>
				<View style={styles.buttons}>
					<StyledButton
						type={'rounded-normal'}
						onPress={onSend}
						containerStyle={[styles.button, styles.leftButton]}
						testID={'drawer-send-button'}
					>
						<View style={styles.buttonContent}>
							<MaterialIcon
								name={'arrow-top-right'}
								size={22}
								color={colors.blue}
								style={styles.buttonIcon}
							/>
							<Text style={styles.buttonText}>{strings('drawer.send_button')}</Text>
						</View>
					</StyledButton>
					<StyledButton
						type={'rounded-normal'}
						onPress={onReceive}
						containerStyle={[styles.button, styles.rightButton]}
						testID={'drawer-receive-button'}
					>
						<View style={styles.buttonContent}>
							<MaterialIcon
								name={'keyboard-tab'}
								size={22}
								color={colors.blue}
								style={[styles.buttonIcon, styles.buttonReceive]}
							/>
							<Text style={styles.buttonText}>{strings('drawer.receive_button')}</Text>
						</View>
					</StyledButton>
				</View>
				<View style={styles.menu}>
					{getSections().map(
						(section, i) =>
							section?.length > 0 && (
								<View
									key={`section_${i}`}
									style={[styles.menuSection, i === 0 ? styles.noTopBorder : null]}
								>
									{section
										.filter((item) => {
											if (!item) return undefined;
											const { name = undefined } = item;
											if (name && name.toLowerCase().indexOf('etherscan') !== -1) {
												const type = network.provider?.type;
												return (type && triggerHasBlockExplorer(type)) || undefined;
											}
											return true;
										})
										.map((item, j) => (
											<TouchableOpacity
												key={`item_${i}_${j}`}
												style={[
													styles.menuItem,
													item.routeNames && item.routeNames.includes(currentRoute)
														? styles.selectedRoute
														: null,
												]}
												ref={item.name === strings('drawer.browser') ? browserSectionRef : null}
												onPress={() => item.action()} // eslint-disable-line
											>
												{item.icon
													? item.routeNames && item.routeNames.includes(currentRoute)
														? item.selectedIcon
														: item.icon
													: null}
												<Text
													style={[
														styles.menuItemName,
														!item.icon ? styles.noIcon : null,
														item.routeNames && item.routeNames.includes(currentRoute)
															? styles.selectedName
															: null,
													]}
													numberOfLines={1}
												>
													{item.name}
												</Text>
												{!seedphraseBackedUp && item.warning ? (
													<SettingsNotification isNotification isWarning>
														<Text style={styles.menuItemWarningText}>{item.warning}</Text>
													</SettingsNotification>
												) : null}
											</TouchableOpacity>
										))}
								</View>
							)
					)}
				</View>
			</ScrollView>
			<Modal
				isVisible={networkModalVisible}
				onBackdropPress={triggerToggleNetworksModal}
				onBackButtonPress={triggerToggleNetworksModal}
				onSwipeComplete={triggerToggleNetworksModal}
				swipeDirection={'down'}
				propagateSwipe
			>
				<NetworkList
					navigation={navigation}
					onClose={onNetworksModalClose}
					showInvalidCustomNetworkAlert={showInvalidCustomNetworkAlert}
				/>
			</Modal>
			<Modal isVisible={!!invalidCustomNetwork}>
				<InvalidCustomNetworkAlert
					navigation={navigation}
					network={invalidCustomNetwork}
					onClose={closeInvalidCustomNetworkAlert}
				/>
			</Modal>
			<Modal
				isVisible={accountsModalVisible}
				style={styles.bottomModal}
				onBackdropPress={triggerToggleAccountsModal}
				onBackButtonPress={triggerToggleAccountsModal}
				onSwipeComplete={triggerToggleAccountsModal}
				swipeDirection={'down'}
				propagateSwipe
			>
				<AccountList
					enableAccountsAddition
					identities={identities}
					selectedAddress={selectedAddress}
					keyrings={keyrings}
					onAccountChange={onAccountChange}
					onImportAccount={onImportAccount}
					ticker={ticker}
				/>
			</Modal>
			{renderOnboardingWizard()}
			<Modal
				isVisible={receiveModalVisible}
				onBackdropPress={triggerToggleReceiveModal}
				onBackButtonPress={triggerToggleReceiveModal}
				onSwipeComplete={triggerToggleReceiveModal}
				swipeDirection={'down'}
				propagateSwipe
				style={styles.bottomModal}
			>
				<ReceiveRequest
					navigation={navigation}
					hideModal={triggerToggleReceiveModal}
					showReceiveModal={showReceiveModal}
				/>
			</Modal>
			<WhatsNewModal navigation={navigation} enabled={showProtectWalletModal === false} />

			{renderProtectModal()}
		</View>
	);
};

export default DrawerView;