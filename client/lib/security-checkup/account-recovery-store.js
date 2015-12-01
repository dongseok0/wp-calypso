/**
 * External dependencies
 */
var React = require( 'react' ),
	debug = require( 'debug' )( 'calypso:lib:security-checkup:account-recovery-store' ),
	assign = require( 'lodash/object/assign' ),
	remove = require( 'lodash/array/remove' );

/**
 * Internal dependencies
 */
var Dispatcher = require( 'dispatcher' ),
	emitter = require( 'lib/mixins/emitter' ),
	actions = require( './constants' ).actions,
	me = require( 'lib/wp' ).undocumented().me();

var _initialized = false,
	_loading = false,
	_phone = {
		isSavingPhone: false,
		isVerifyingPhone: false,
		lastNotice: false,
		data: {}
	},
	_emails = {
		isAddingEmail: false,
		lastNotice: false,
		data: {}
	};

var AccountRecoveryStore = {
	isAddRecoveryEmail: function() {
		return _emails.isAddingEmail;
	},

	isVerificationEmailSent: function() {
		return _emails.isVerificationEmailSent;
	},

	isVerifyingPhone: function() {
		return _phone.isVerifyingPhone;
	},

	getEmails: function() {
		fetchFromAPIIfNotInitialized();

		return assign( {
			loading: _loading
		}, _emails );
	},

	getPhone: function() {
		fetchFromAPIIfNotInitialized();

		return assign( {
			loading: _loading
		}, _phone );
	},

	getEmailsNotice: function() {
		return _emails.lastNotice;
	},

	getPhoneNotice: function() {
		return _phone.lastNotice;
	}
};

function emitChange() {
	AccountRecoveryStore.emit( 'change' );
}

function fetchFromAPIIfNotInitialized() {
	if ( _initialized ) {
		return;
	}

	_initialized = true;
	fetchFromAPI();
}

function fetchFromAPI() {
	if ( _loading ) {
		return;
	}

	_loading = true;
	me.getAccountRecovery( function( error, data ) {
		_loading = false;

		if ( error ) {
			handleError( error );
			return;
		}

		handleResponse( data );
	} );
}

function handleResponse( data ) {
	if ( data.phone ) {
		_phone.data = {
			countryCode: data.phone.country_code,
			countryNumericCode: data.phone.country_numeric_code,
			number: data.phone.number,
			numberFull: data.phone.number_full
		};
	}

	if ( data.emails ) {
		_emails.data = data.emails
	}

	emitChange();
}

function handleError( error ) {
	setEmailsNotice( error.message, 'error' );
	setPhoneNotice( error.message, 'error' );
	emitChange();
}

function removeEmail( deletedEmail ) {
	_emails.data = remove( _emails.data, function( recoveryEamil ) {
		return recoveryEamil !== deletedEmail;
	} );

	emitChange();
}

function setEmailsNotice( message, type ) {
	_emails.lastNotice = {
		type: type,
		message: message
	};
}

function resetEmailsNotice() {
	_emails.lastNotice = false;
}

function setPhoneNotice( message, type ) {
	_phone.lastNotice = {
		type: type,
		message: message
	};
}

function resetPhoneNotice() {
	_phone.lastNotice = false;
}

AccountRecoveryStore.dispatchToken = Dispatcher.register( function( payload ) {
	var action = payload.action;
	debug( 'action triggered', action.type, payload );

	switch ( action.type ) {
		case actions.ADD_ACCOUNT_RECOVERY_EMAIL:
			_emails.isAddingEmail = true;
			emitChange();
			break;

		case actions.RECEIVE_ADDED_ACCOUNT_RECOVERY_EMAIL:
			_emails.isAddingEmail = false;
			if ( action.error ) {
				emitChange();
				break;
			}
			_emails.lastNotice = { type: 'success', message: this.translate( 'We have sent a verification email to {{email/}}. please verify', { components: { email: <strong>{ action.email }</strong> } } ) };
			emitChange();
			break;

		case actions.DELETE_ACCOUNT_RECOVERY_EMAIL:
			emitChange();
			break;

		case actions.RECEIVE_DELETED_ACCOUNT_RECOVERY_EMAIL:
			if ( action.error ) {
				emitChange();
				break;
			}

			removeEmail( action.email );
			emitChange();
			break;
		case actions.SAVE_ACCOUNT_RECOVERY_PHONE:
			_phone.isSavingPhone = true;
			emitChange();
			break;

		case actions.RECEIVE_SAVED_ACCOUNT_RECOVERY_PHONE:
			_phone.isSavingPhone = false;
			if ( action.error ) {
				emitChange();
				break;
			}

			emitChange();
			break;

		case actions.VERIFY_ACCOUNT_RECOVERY_PHONE:
			_phone.isVerifyingPhone = true;
			emitChange();
			break;

		case actions.RECEIVE_VERIFIED_ACCOUNT_RECOVERY_PHONE:
			_phone.isVerifyingPhone = false;
			if ( action.error ) {
				emitChange();
				break;
			}

			emitChange();
			break;

		case actions.DELETE_ACCOUNT_RECOVERY_PHONE:
			emitChange();
			break;

		case actions.RECEIVE_DELETED_ACCOUNT_RECOVERY_PHONE:
			if ( action.error ) {
				break;
			}

			emitChange();
			break;

		case actions.DISMISS_ACCOUNT_RECOVERY_EMAILS_NOTICE:
			resetEmailsNotice();
			emitChange();
			break;

		case actions.DISMISS_ACCOUNT_RECOVERY_PHONE_NOTICE:
			resetPhoneNotice();
			emitChange();
			break;
	}
} );

emitter( AccountRecoveryStore );

module.exports = AccountRecoveryStore;
