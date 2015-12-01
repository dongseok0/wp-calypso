/**
 * External dependencies
 */
import React from 'react';
import isEmpty from 'lodash/lang/isEmpty';

/**
 * Internal dependencies
 */
import AccountRecoveryStore from 'lib/security-checkup/account-recovery-store';
import SecurityCheckupActions from 'lib/security-checkup/actions';
import FormSectionHeading from 'components/forms/form-section-heading';
import FormButton from 'components/forms/form-button';
import FormButtonsBar from 'components/forms/form-buttons-bar';
import FormPhoneInput from 'components/forms/form-phone-input';
import FormTextInput from 'components/forms/form-text-input';
import FormInputValidation from 'components/forms/form-input-validation';
import countriesList from 'lib/countries-list';

module.exports = React.createClass( {
	displayName: 'SecurityCheckupRecoveryPhone',

	mixins: [ React.addons.LinkedStateMixin ],

	componentDidMount: function() {
		AccountRecoveryStore.on( 'change', this.refreshRecoveryPhone );
	},

	componentWillUnmount: function() {
		AccountRecoveryStore.off( 'change', this.refreshRecoveryPhone );
	},

	getInitialState: function() {
		return {
			recoveryPhone: AccountRecoveryStore.getPhone(), // @TODO this should be a prop
			recoveryPhoneScreen: 'recoveryPhone',
			recoveryPhoneValidationError: '',
			verificationCode: '',
			verificationCodeValidationError: '',
			isSendingCode: false,
			isVerifyingCode: false
		};
	},

	refreshRecoveryPhone: function() {
		this.setState( {
			recoveryPhone: AccountRecoveryStore.getPhone()
		} );
	},

	edit: function() {
		this.setState( { recoveryPhoneScreen: 'editRecoveryPhone' } );
	},

	sendCode: function() {
		var countryCode = this.state.recoveryPhone.data.number;
		var phoneNumber = this.state.recoveryPhone.data.countryCode;

		if ( this.state.phoneNumber && ! this.state.phoneNumber.isValid ) {
			this.setState( { recoveryPhoneValidationError: this.translate( 'Please enter a valid phone number.' ) } );
			return;
		}

		if ( ! isEmpty( this.state.phoneNumber ) ) {
			phoneNumber = this.state.phoneNumber.countryData.code;
			countryCode = this.state.phoneNumber.phoneNumber;
		}

		this.setState( { isSendingCode: true } );

		SecurityCheckupActions.addPhone( countryCode, phoneNumber );
	},

	verifyCode: function() {
		if ( this.state.verificationCode.length !== 7 ) { // @TODO should 7 be a constant declared?
			this.setState( { verificationCodeValidationError: this.translate( 'Please enter a valid code.' ) } );
			return;
		}

		this.setState( { isVerifyingCode: true } );

		SecurityCheckupActions.verifyPhone( this.state.verificationCode );
	},

	cancel: function() {
		this.setState( { recoveryPhoneScreen: 'recoveryPhone', recoveryPhoneValidationError: '' } );
	},

	onChangePhoneInput: function( phoneNumber ) {
		this.setState( { phoneNumber } );
	},

	recoveryPhonePlaceHolder: function() {
		return(
			<div className="security-checkup__recovery-phone-placholder">
				<FormSectionHeading>Recovery phone placeholder</FormSectionHeading>
				<p className="security-checkup__recovery-phone">Recovery phone placeholder</p>
			</div>
		);
	},

	getRecoveryPhone: function() {
		if ( isEmpty( this.state.recoveryPhone.data ) ) {
			return(
				<p>No recovery phone</p>
			);
		}

		return (
			<p className="security-checkup__recovery-phone">{ this.state.recoveryPhone.data.numberFull }</p>
		);
	},

	recoveryPhone: function() {
		return (
			<div>
				<FormSectionHeading>Recovery phone</FormSectionHeading>
				{ this.getRecoveryPhone() }
				<FormButton onClick={ this.edit } isPrimary={ false } >
					{ this.translate( 'Edit Phone' ) }
				</FormButton>
			</div>
		);
	},

	renderRecoveryPhoneValidation: function() {
		if ( isEmpty( this.state.recoveryPhoneValidationError ) ) {
			return null;
		}

		return(
			<FormInputValidation isError={ true } text={ this.state.recoveryPhoneValidationError } />
		);
	},

	editRecoveryPhone: function() {
		return(
			<div>
				<FormPhoneInput
					countriesList={ countriesList.forSms() }
					initialCountryCode={ this.state.recoveryPhone.data.countryCode }
					initialPhoneNumber={ this.state.recoveryPhone.data.number }
					onChange={ this.onChangePhoneInput }
					/>
				<FormButtonsBar>
					<FormButton onClick={ this.sendCode } >
						{ this.state.isSendingCode ? this.translate( 'Sending code' ) : this.translate( 'Send code' ) }
					</FormButton>
					<FormButton onClick={ this.cancel } isPrimary={ false } >
						{ this.translate( 'Cancel' ) }
					</FormButton>
				</FormButtonsBar>
				{ this.renderRecoveryPhoneValidation() }
			</div>
		);
	},

	verfiyRecoveryPhone: function() {
		return(
			<div>
				<FormTextInput valueLink={ this.linkState( 'verificationCode' ) } ></FormTextInput>
				<FormButtonsBar>
					<FormButton onClick={ this.verifyCode } >
						{ this.state.isVerifyingCode ? this.translate( 'Verifying code' ) : this.translate( 'Verify code' ) }
					</FormButton>
					<FormButton onClick={ this.cancel } isPrimary={ false } >
						{ this.translate( 'Cancel' ) }
					</FormButton>
				</FormButtonsBar>
			</div>
		);
	},

	getRecoveryPhoneScreen: function() {
		if ( this.state.recoveryPhone.loading ) {
			return this.recoveryPhonePlaceHolder();
		}

		switch ( this.state.recoveryPhoneScreen ) {
			case 'recoveryPhone':
				return this.recoveryPhone();
			case 'editRecoveryPhone':
				return this.editRecoveryPhone();
			case 'verfiyRecoveryPhone':
				return this.verfiyRecoveryPhone();
			default:
				return this.recoveryPhone();
		}
	},

	render: function() {
		return (
			<div className="security-checkup__recovery-phone-container">
				{ this.getRecoveryPhoneScreen() }
			</div>
		);
	}
} );
