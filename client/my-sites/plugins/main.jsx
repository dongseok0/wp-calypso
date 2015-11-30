/**
 * External dependencies
 */
import React from 'react/addons'
import debugModule from 'debug'
import titleCase from 'to-title-case'
import classNames from 'classnames'
import some from 'lodash/collection/some'
import find from 'lodash/collection/find'
import filter from 'lodash/collection/filter'
import reject from 'lodash/collection/reject'
import assign from 'lodash/object/assign'
import property from 'lodash/utility/property'
import isEmpty from 'lodash/lang/isEmpty'

/**
 * Internal dependencies
 */
import acceptDialog from 'lib/accept'
import analytics from 'analytics'
import config from 'config'
import { abtest } from 'lib/abtest'
import Main from 'components/main'
import SidebarNavigation from 'my-sites/sidebar-navigation'
import pluginsAccessControl from 'my-sites/plugins/access-control'
import { isBusiness } from 'lib/products-values'
import PluginItem from './plugin-item/plugin-item'
import SectionNav from 'components/section-nav'
import NavTabs from 'components/section-nav/tabs'
import NavItem from 'components/section-nav/item'
import Search from 'components/search'
import URLSearch from 'lib/mixins/url-search'
import EmptyContent from 'components/empty-content'
import DisconnectJetpackDialog from 'my-sites/plugins/disconnect-jetpack/disconnect-jetpack-dialog'
import PluginsActions from 'lib/plugins/actions'
import PluginsLog from 'lib/plugins/log-store'
import PluginsStore from 'lib/plugins/store'
import PluginsDataStore from 'lib/plugins/wporg-data/store'
import PluginNotices from 'lib/plugins/notices'
import JetpackManageErrorPage from 'my-sites/jetpack-manage-error-page'
import PlanNudge from 'components/plans/plan-nudge'
import SectionHeader from 'components/section-header'
import SectionHeaderButton from 'components/section-header/button'

/**
 * Module variables
 */
const debug = debugModule( 'calypso:my-sites:plugins' );

export default React.createClass( {

	displayName: 'Plugins',

	mixins: [ URLSearch, PluginNotices ],

	getInitialState() {
		return this.getPluginsState( this.props );
	},

	filterSelection: {
		active( plugin ) {
			if ( plugin.selected ) {
				return some( plugin.sites, site => site.plugin && site.plugin.active );
			}
			return false;
		},
		inactive( plugin ) {
			if ( plugin.selected ) {
				return plugin.sites.some( site => site.plugin && ! site.plugin.active );
			}
			return false;
		},
		updates( plugin ) {
			if ( plugin.selected ) {
				return plugin.sites.some( site => site.plugin && site.plugin.update && site.canUpdateFiles );
			}
			return false;
		},
		selected( plugin ) {
			return plugin.selected;
		}
	},

	componentDidMount() {
		debug( 'Plugins React component mounted.' );
		this.props.sites.on( 'change', this.refreshPlugins );
		PluginsStore.on( 'change', this.refreshPlugins );
		PluginsDataStore.on( 'change', this.refreshPlugins );
		PluginsLog.on( 'change', this.showDisconnectDialog );
	},

	componentWillUnmount() {
		this.props.sites.removeListener( 'change', this.refreshPlugins );
		PluginsStore.removeListener( 'change', this.refreshPlugins );
		PluginsDataStore.removeListener( 'change', this.refreshPlugins );
		PluginsLog.removeListener( 'change', this.showDisconnectDialog );

		PluginsActions.selectPlugins( this.props.sites.getSelectedOrAll(), 'none' );
	},

	componentWillReceiveProps( nextProps ) {
		this.refreshPlugins( nextProps );
	},

	getPluginsFromStore( nextProps, sites ) {
		const props = nextProps || this.props;
		let	plugins = PluginsStore.getPlugins( sites, props.filter );

		if ( ! plugins ) {
			return plugins;
		}

		if ( props && props.search ) {
			plugins = plugins.filter( this.matchSearchTerms.bind( this, props.search ) );
		}

		return this.addWporgDataToPlugins( plugins );
	},

	// plugins for Jetpack sites require additional data from the wporg-data store
	addWporgDataToPlugins( plugins ) {
		return plugins.map( plugin => {
			if ( ! plugin.wpcom ) {
				return assign( {}, plugin, PluginsDataStore.get( plugin.slug ) );
			}
			return plugin;
		} );
	},

	getJetpackPlugins() {
		return reject( this.state.plugins, property( 'wpcom' ) );
	},

	getWpcomPlugins() {
		return filter( this.state.plugins, property( 'wpcom' ) );
	},

	getPluginsState( nextProps ) {
		const sites = this.state && this.state.bulkManagement ? this.props.sites.getSelectedOrAllWithPlugins() : this.props.sites.getSelectedOrAll(),
			pluginUpdate = PluginsStore.getPlugins( sites, 'updates' );

		return {
			accessError: pluginsAccessControl.hasRestrictedAccess(),
			plugins: this.getPluginsFromStore( nextProps, sites ),
			pluginUpdateCount: pluginUpdate && pluginUpdate.length
		};
	},

	refreshPlugins( nextProps ) {
		this.setState( this.getPluginsState( nextProps ) );
	},

	showDisconnectDialog() {
		if ( this.state.disconnectJetpackDialog && ! this.state.notices.inProgress.length ) {
			this.setState( { disconnectJetpackDialog: false } );
			this.refs.dialog.open();
		}
	},

	getSelected() {
		if ( ! this.state.plugins ) {
			return [];
		}
		return this.state.plugins.filter( this.filterSelection.selected );
	},

	areSelected( filterSelection ) {
		const selectedFilter = filterSelection ? filterSelection : 'selected';
		if ( ! this.state.plugins ) {
			return false;
		}
		return this.state.plugins.some( this.filterSelection[ selectedFilter ] );
	},

	recordEvent( eventAction, includeSelectedPlugins ) {
		eventAction += ( this.props.site ? '' : ' on Multisite' );

		if ( includeSelectedPlugins ) {
			const pluginSlugs = this.getSelected().map( plugin => plugin.slug );
			analytics.ga.recordEvent( 'Plugins', eventAction, 'Plugins', pluginSlugs );
		} else {
			analytics.ga.recordEvent( 'Plugins', eventAction );
		}
	},

	changeSelectionOptionsState() {
		this.setState( { selectionOptionsOpen: ! this.state.selectionOptionsOpen } );
	},

	matchSearchTerms( search, plugin ) {
		search = search.toLowerCase();
		return [ 'name', 'description', 'author' ].some( attribute =>
			plugin[ attribute ] && plugin[ attribute ].toLowerCase().indexOf( search ) !== -1
		);
	},

	toggleBulkManagement() {
		const bulkManagement = ! this.state.bulkManagement,
			sites = bulkManagement ? this.props.sites.getSelectedOrAllWithPlugins() : this.props.sites.getSelectedOrAll();

		this.setState( {
			plugins: this.getPluginsFromStore( this.props, sites ),
			bulkManagement: bulkManagement,
			filter: 'all'
		} );

		if ( bulkManagement ) {
			this.recordEvent( 'Clicked Manage' );
		} else {
			PluginsActions.selectPlugins( this.props.sites.getSelectedOrAll(), 'none' );
			PluginsActions.removePluginsNotices( this.state.notices.completed.concat( this.state.notices.errors ) );
			this.recordEvent( 'Clicked Manage Done' );
		}
	},

	togglePluginSelection( plugin ) {
		PluginsActions.togglePluginSelection( plugin );
		analytics.ga.recordEvent( 'Plugins', 'Clicked to ' + plugin.selected ? 'Deselect' : 'Select' + 'Single Plugin', 'Plugin Name', plugin.slug );
	},

	unselectOrSelectAll() {
		if ( this.areSelected() ) {
			PluginsActions.selectPlugins( this.props.sites.getSelectedOrAllWithPlugins(), 'none' );
			this.recordEvent( 'Clicked to Uncheck All Plugins' );
			return;
		}
		PluginsActions.selectPlugins( this.props.sites.getSelectedOrAllWithPlugins(), 'all' );
		this.recordEvent( 'Clicked to Check All Plugins' );
	},

	doActionOverSelected( actionName, action ) {
		PluginsActions.removePluginsNotices( this.state.notices.completed.concat( this.state.notices.errors ) );
		this.state.plugins.forEach( plugin => {
			if ( plugin.selected ) {
				// Ignore the user trying to deactive Jetpack.
				// Dialog to confirm the disconnection will be handled after.
				if ( 'deactivating' === actionName && plugin.slug === 'jetpack' ) {
					return;
				}
				plugin.sites.forEach( site => action( site, site.plugin ) );
			}
		} );
	},

	activateSelected() {
		this.doActionOverSelected( 'activating', PluginsActions.activatePlugin );
		this.recordEvent( 'Clicked Activate Plugin(s)', true );
	},

	deactivateSelected() {
		this.doActionOverSelected( 'deactivating', PluginsActions.deactivatePlugin );
		this.recordEvent( 'Clicked Deactivate Plugin(s)', true );
	},

	deactiveAndDisconnectSelected() {
		var waitForDeactivate = false;

		this.doActionOverSelected( 'deactivating', ( site, plugin ) => {
			waitForDeactivate = true;
			PluginsActions.deactivatePlugin( site, plugin );
		} );
		if ( waitForDeactivate ) {
			this.setState( { disconnectJetpackDialog: true } );
		} else {
			this.refs.dialog.open();
		}

		this.recordEvent( 'Clicked Deactivate Plugin(s) and Disconnect Jetpack', true );
	},

	getConfirmationText() {
		let pluginsList = {},
			sitesList = {},
			pluginName,
			siteName;

		this.state.plugins
			.filter( plugin => plugin.selected )
			.forEach( ( plugin ) => {
				pluginsList[ plugin.slug ] = true;
				pluginName = plugin.name || plugin.slug;

				plugin.sites.forEach( ( site ) => {
					if ( site.canUpdateFiles ) {
						sitesList[ site.ID ] = true;
						siteName = site.title;
					}
				} );
			} );

		const pluginsListSize = Object.keys( pluginsList ).length;
		const siteListSize = Object.keys( sitesList ).length;
		const combination = ( siteListSize > 1 ? 'n sites' : '1 site' ) + ' ' + ( pluginsListSize > 1 ? 'n plugins' : '1 plugin' );

		switch ( combination ) {
			case '1 site 1 plugin':
				return this.translate( 'You are about to remove {{em}}%(plugin)s from %(site)s{{/em}}.{{p}}This will deactivate the plugin and delete all associated files and data.{{/p}}', {
					components: {
						em: <em />,
						p: <p />
					},
					args: {
						plugin: pluginName,
						site: siteName
					}
				} );
				break;
			case '1 site n plugins':
				return this.translate( 'You are about to remove {{em}}%(numberOfPlugins)d plugins from %(site)s{{/em}}.{{p}}This will deactivate the plugins and delete all associated files and data.{{/p}}', {
					components: {
						em: <em />,
						p: <p />
					},
					args: {
						numberOfPlugins: pluginsListSize,
						site: siteName
					}
				} );
				break;
			case 'n sites 1 plugin':
				return this.translate( 'You are about to remove {{em}}%(plugin)s from %(numberOfSites)d sites{{/em}}.{{p}}This will deactivate the plugin and delete all associated files and data.{{/p}}', {
					components: {
						em: <em />,
						p: <p />
					},
					args: {
						plugin: pluginName,
						numberOfSites: siteListSize
					}
				} );
				break;
			case 'n sites n plugins':
				return this.translate( 'You are about to remove {{em}}%(numberOfPlugins)d plugins from %(numberOfSites)d sites{{/em}}.{{p}}This will deactivate the plugins and delete all associated files and data.{{/p}}', {
					components: {
						em: <em />,
						p: <p />
					},
					args: {
						numberOfPlugins: pluginsListSize,
						numberOfSites: siteListSize
					}
				} );
				break;
		}
	},

	removePluginNotice() {
		const message = (
			<div>
				<span>{ this.getConfirmationText() }</span>
				<span>{ this.translate( 'Do you want to continue?' ) }</span>
			</div>
		);

		acceptDialog(
			message,
			this.removeSelected,
			this.translate( 'Remove', { context: 'Verb. Presented to user as a label for a button.' } )
		);
	},

	removeSelected( accepted ) {
		if ( accepted ) {
			this.doActionOverSelected( 'removing', PluginsActions.removePlugin );
			this.recordEvent( 'Clicked Remove Plugin(s)', true );
		}
	},

	updateSelected() {
		this.doActionOverSelected( 'updating', PluginsActions.updatePlugin );
		this.recordEvent( 'Clicked Update Plugin(s)', true );
	},

	setAutoupdateSelected() {
		this.doActionOverSelected( 'enablingAutoupdates', PluginsActions.enableAutoUpdatesPlugin );
		this.recordEvent( 'Clicked Enable Autoupdate Plugin(s)', true );
	},

	unsetAutoupdateSelected() {
		this.doActionOverSelected( 'disablingAutoupdates', PluginsActions.disableAutoUpdatesPlugin );
		this.recordEvent( 'Clicked Disable Autoupdate Plugin(s)', true );
	},

	setPluginFilter( filterSelection ) {
		PluginsActions.selectPlugins( this.props.sites.getSelectedOrAllWithPlugins(), filterSelection );
		this.setState( { selectionOptionsOpen: false } );
		this.recordEvent( 'Clicked to Select ' + titleCase( filterSelection ) + ' Plugin(s)' );
	},

	siteSuffix() {
		return ( this.props.sites.selected || this.props.sites.get().length === 1 ) ? '/' + this.props.sites.selected : '';
	},

	placeholders() {
		const placeholderCount = 16;
		return [ ... Array( placeholderCount ).keys() ].map( i => <PluginItem key={ 'placeholder-' + i } /> );
	},

	formatPlugins( plugins, disableManage ) {
		const manageableSites = this.props.sites.getSelectedOrAllJetpackCanManage();

		return plugins.map( plugin => {
			const hasAllNoManageSites = ! plugin.wpcom && plugin.sites.every( pluginSite => manageableSites.every( site => site.slug !== pluginSite.slug ) );
			return (
				<PluginItem
					key={ plugin.slug }
					hasAllNoManageSites={ hasAllNoManageSites }
					plugin={ plugin }
					sites={ plugin.sites }
					isSelected={ plugin.selected }
					isSelectable={ this.state.bulkManagement && ! disableManage }
					onClick={ this.togglePluginSelection.bind( this, plugin ) }
					pluginLink={ this.props.path + '/' + encodeURIComponent( plugin.slug ) + ( plugin.wpcom ? '/business' : '' ) + this.siteSuffix() }
					progress={ this.state.notices.inProgress.filter( log => log.plugin.slug === plugin.slug ) }
					errors={
						this.state.notices.errors.filter( log => log.plugin && log.plugin.slug === plugin.slug )
					}
					notices={ this.state.notices }
					selectedSite={ this.props.sites.getSelectedSite() } />
			);
		} );
	},

	renderPluginList( plugins, header, disableManage ) {
		let headerMarkup;

		if ( isEmpty( plugins ) ) {
			return;
		}

		const itemListClasses = classNames( 'list-cards-compact', 'plugins__list', {
			'is-bulk-editing': this.state.bulkManagement && ! disableManage
		} );

		headerMarkup = (
			<SectionHeader label={ header }>
				{ disableManage ? null : this.getCurrentActionButtons() }
			</SectionHeader>
		);

		return (
			<span>
				{ headerMarkup }
				<div className={ itemListClasses }>{ this.formatPlugins( plugins, disableManage ) }</div>
			</span>
		);
	},

	getFilters() {
		const siteFilter = this.props.sites.selected ? '/' + this.props.sites.selected : '';

		return [
			{
				title: this.translate( 'All', { context: 'Filter label for plugins list' } ),
				path: '/plugins' + siteFilter,
				id: 'all'
			},
			{
				title: this.translate( 'Active', { context: 'Filter label for plugins list' } ),
				path: '/plugins/active' + siteFilter,
				id: 'active'
			},
			{
				title: this.translate( 'Inactive', { context: 'Filter label for plugins list' } ),
				path: '/plugins/inactive' + siteFilter,
				id: 'inactive'
			},
			{
				title: this.translate( 'Updates', { context: 'Filter label for plugins list' } ),
				path: '/plugins/updates' + siteFilter,
				id: 'updates'
			}
		];
	},

	getSelectedText() {
		const found = find( this.getFilters(), filterItem => this.props.filter === filterItem.id );
		if ( 'undefined' !== typeof found ) {
			return found.title;
		}
		return '';
	},

	getSearchPlaceholder() {
		switch ( this.props.filter ) {
			case 'active':
				return this.translate( 'Search All…', { textOnly: true } );

			case 'inactive':
				return this.translate( 'Search Inactive…', { textOnly: true } );

			case 'updates':
				return this.translate( 'Search Updates…', { textOnly: true } );

			case 'all':
				return this.translate( 'Search All…', { textOnly: true } );
		}
	},

	canUpdatePlugins() {
		return this.state.plugins
			.filter( plugin => plugin.selected )
			.some( plugin => plugin.sites.some( site => site.canUpdateFiles ) );
	},

	getCurrentActionButtons() {
		let buttons = [];
		const hasWpcomPlugins = this.getSelected().some( property( 'wpcom' ) );
		const isJetpackSelected = this.state.plugins.some( plugin => plugin.selected && 'jetpack' === plugin.slug );

		if ( ! hasWpcomPlugins && this.canUpdatePlugins() && this.areSelected( 'updates' ) ) { // needs updates
			buttons.push( <SectionHeaderButton onClick={ this.updateSelected }>{ this.translate( 'Update' ) }</SectionHeaderButton> );
		}

		if ( ! hasWpcomPlugins && this.canUpdatePlugins() && config.isEnabled( 'manage/plugins/browser' ) && ! isJetpackSelected ) {  // needs remove
			buttons.push( <SectionHeaderButton onClick={ this.removePluginNotice }>{ this.translate( 'Remove' ) }</SectionHeaderButton> );
		}

		if ( ! hasWpcomPlugins && this.canUpdatePlugins() && this.areSelected() ) { // needs autoupdates
			buttons.push( <SectionHeaderButton onClick={ this.setAutoupdateSelected }>{ this.translate( 'Autoupdate' ) }</SectionHeaderButton> );
			buttons.push( <SectionHeaderButton onClick={ this.unsetAutoupdateSelected }>{ this.translate( 'Manually update' ) }</SectionHeaderButton> );
		}

		if ( this.areSelected( 'inactive' ) ) { // needs activate button
			buttons.push( <SectionHeaderButton onClick={ this.activateSelected }>{ this.translate( 'Activate' ) }</SectionHeaderButton> )
		}

		if ( this.areSelected( 'active' ) ) {
			let deactivateButton = isJetpackSelected
				? <SectionHeaderButton onClick={ this.deactiveAndDisconnectSelected }>{ this.translate( 'Disconnect' ) }</SectionHeaderButton>
				: <SectionHeaderButton onClick={ this.deactivateSelected }>{ this.translate( 'Deactivate' ) }</SectionHeaderButton>;
			buttons.push( deactivateButton )
		}

		if ( this.props && this.props.filter === 'updates' ) {
			buttons.push(
				<SectionHeaderButton onClick={ this.updateAllPlugins } >
					{ this.translate( 'Update All', { context: 'button label' } ) }
				</SectionHeaderButton>
			);
		}

		buttons.push(
			<SectionHeaderButton onClick={ this.toggleBulkManagement } selected={ this.state.bulkManagement }>
					{
						this.state.bulkManagement ?
						this.translate( 'Done', { context: 'button label' } ) :
						this.translate( 'Bulk Edit', { context: 'button label' } )
					}
			</SectionHeaderButton>
		);
		return buttons;
	},

	getEmptyContentUpdateData() {
		let emptyContentData = { illustration: '/calypso/images/drake/drake-ok.svg' },
			selectedSite = this.props.sites.getSelectedSite();

		if ( selectedSite ) {
			emptyContentData.title = this.translate( 'All plugins on %(siteName)s are up to date.', {
				textOnly: true,
				args: { siteName: selectedSite.title }
			} );
		} else {
			emptyContentData.title = this.translate( 'All plugins are up to date.', { textOnly: true } );
		}

		if ( this.getUpdatesTabVisibility() ) {
			return emptyContentData;
		}

		emptyContentData.action = this.translate( 'All Plugins', { textOnly: true } );

		if ( selectedSite ) {
			emptyContentData.actionURL = '/plugins/' + selectedSite.slug;
			if ( selectedSite.jetpack ) {
				emptyContentData.illustration = '/calypso/images/drake/drake-jetpack.svg';
				emptyContentData.title = this.translate( 'Plugins can\'t be updated on %(siteName)s.', {
					textOnly: true,
					args: { siteName: selectedSite.title }
				} );
			} else {
				// buisness plan sites
				emptyContentData.title = this.translate( 'Plugins are updated automatically on %(siteName)s.', {
					textOnly: true,
					args: { siteName: selectedSite.title }
				} );
			}
		} else {
			emptyContentData.title = this.translate( 'No updates are available.', { textOnly: true } );
			emptyContentData.illustration = '/calypso/images/drake/drake-empty-results.svg';
			emptyContentData.actionURL = '/plugins';
		}

		return emptyContentData;
	},

	getEmptyContentData() {
		let emptyContentData = { illustration: '/calypso/images/drake/drake-empty-results.svg', };

		if ( this.props.search ) {
			emptyContentData.title = this.translate( 'No plugins match your search for {{searchTerm/}}.', {
				textOnly: true,
				components: { searchTerm: <em>{ this.props.search }</em> }
			} );
		} else {
			switch ( this.props.filter ) {
				case 'inactive':
					emptyContentData.title = this.translate( 'No plugins are inactive.', { textOnly: true } );
					break;
				case 'updates':
					emptyContentData = this.getEmptyContentUpdateData();
					break;
				default:
					emptyContentData.title = this.translate( 'No plugins match that filter.', { textOnly: true } );
			}
		}

		return emptyContentData;
	},

	getUpdatesTabVisibility() {
		const selectedSite = this.props.sites.getSelectedSite();

		if ( selectedSite ) {
			return selectedSite.jetpack && selectedSite.canUpdateFiles;
		}

		return some( this.props.sites.getSelectedOrAllWithPlugins(), site => site && site.jetpack && site.canUpdateFiles );
	},

	updateAllPlugins() {
		PluginsActions.removePluginsNotices( this.state.notices.completed.concat( this.state.notices.errors ) );
		this.state.plugins.forEach( plugin => {
			plugin.sites.forEach( site => PluginsActions.updatePlugin( site, site.plugin ) );
		} );
		this.recordEvent( 'Clicked Update all Plugins', true );
	},

	getPluginsContent() {
		const plugins = this.state.plugins || [];

		if ( isEmpty( plugins ) && ( this.props.search || 'inactive' === this.props.filter || 'updates' === this.props.filter ) ) {
			let emptyContentData = this.getEmptyContentData();
			return (
				<EmptyContent
					title={ emptyContentData.title }
					illustration={ emptyContentData.illustration }
					actionURL={ emptyContentData.actionURL }
					action={ emptyContentData.action } />
			);;
		} else {
			return (
				<div className="plugins__lists">
					{ this.renderPluginList( this.getWpcomPlugins(), this.translate( 'WordPress.com Plugins' ), true ) }
					{ this.renderPluginList( this.getJetpackPlugins(), this.translate( 'Jetpack Plugins' ) ) }
					{ ! this.state.plugins && this.placeholders() }
				</div>
			);
		}
	},

	render() {
		if ( this.state.accessError ) {
			return (
				<Main>
					<EmptyContent { ...this.state.accessError } />
				</Main>
			);
		}

		const selectedSite = this.props.sites.getSelectedSite();
		if ( abtest( 'businessPluginsNudge' ) === 'nudge' && selectedSite && ! selectedSite.jetpack && ! isBusiness( selectedSite.plan ) ) {
			return (
				<Main>
					<PlanNudge currentProductId={ selectedSite.plan.product_id } selectedSiteSlug={ selectedSite.slug } />
				</Main>
			);
		}

		if ( selectedSite &&
				selectedSite.modulesFetched &&
				! selectedSite.canManage() ) {
			return (
				<Main>
					<JetpackManageErrorPage
						template="optInManage"
						site={ this.props.site }
						actionURL={ selectedSite.getRemoteManagementURL() }
						illustration= '/calypso/images/drake/drake-jetpack.svg'
					/>
				</Main>
			);
		}

		const containerClass = classNames( {
			'main-column': true,
			plugins: true,
			'search-open': this.getSearchOpen()
		} );

		return (
			<Main className={ containerClass }>
				<SidebarNavigation />
				<SectionNav selectedText={ this.getSelectedText() }>
					<NavTabs>
						{ this.getFilters().map( filterItem => {
							if ( 'updates' === filterItem.id && ! this.getUpdatesTabVisibility() ) {
								return null;
							}
							const count = 'updates' === filterItem.id && this.state.pluginUpdateCount;
							return (
								<NavItem key={ filterItem.id } path={ filterItem.path } selected={ filterItem.id === this.props.filter } count={ count } >
									{ filterItem.title }
								</NavItem>
							);
						} ) }
					</NavTabs>

					<Search
						pinned
						onSearch={ this.doSearch }
						initialValue={ this.props.search }
						ref="url-search"
						analyticsGroup="Plugins"
						placeholder={ this.getSearchPlaceholder() }
					/>
				</SectionNav>
				{ this.getPluginsContent() }
				<DisconnectJetpackDialog ref="dialog" site={ this.props.site } sites={ this.props.sites } redirect="/plugins" />
			</Main>
		);
	}
} );
