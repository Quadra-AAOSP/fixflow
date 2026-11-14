package com.example.fixflow.service;

import org.springframework.http.HttpStatus;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.TechnicianContract;
import com.example.fixflow.web.ApiException;

/** Snapshots a site's configured flat fee onto a technician contract at signing. */
final class ContractFees {

	private ContractFees() {
	}

	static void applySnapshot(TechnicianContract contract, Site site) {
		Long fee = site.getContractFlatFeeMinor();
		if (fee == null) {
			throw new ApiException(
					HttpStatus.BAD_REQUEST.value(),
					"Configure the site contract flat fee before signing technicians"
			);
		}
		if (fee < 0) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(), "Site contract flat fee is invalid");
		}
		contract.setFlatFeeMinor(fee);
		String currency = site.getContractFeeCurrency();
		contract.setFeeCurrency(
				currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase()
		);
	}
}
