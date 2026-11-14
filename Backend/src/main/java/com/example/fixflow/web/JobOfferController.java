package com.example.fixflow.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.JobOfferService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api")
public class JobOfferController {

	private final JobOfferService offers;

	public JobOfferController(JobOfferService offers) {
		this.offers = offers;
	}

	public record CreateOffer(
			@NotNull @Positive Long technicianId,
			@NotNull @Positive Long amountMinor,
			@Size(min = 3, max = 8) String currency,
			@Size(max = 1000) String note) {
	}

	public record CounterOffer(
			@NotNull @Positive Long amountMinor,
			@Size(max = 1000) String note) {
	}

	public record RejectOffer(@Size(max = 1000) String note) {
	}

	@GetMapping("/technicians/me/job-offers")
	public List<JobOfferService.OfferView> mine(@AuthenticationPrincipal AppUserDetails actor) {
		return offers.mine(actor);
	}

	@GetMapping("/reports/{reportId}/job-offers")
	public List<JobOfferService.OfferView> forReport(
			@PathVariable Long reportId, @AuthenticationPrincipal AppUserDetails actor) {
		return offers.forReport(reportId, actor);
	}

	@PostMapping("/reports/{reportId}/job-offers")
	@ResponseStatus(HttpStatus.CREATED)
	public JobOfferService.OfferView create(
			@PathVariable Long reportId,
			@Valid @RequestBody CreateOffer body,
			@AuthenticationPrincipal AppUserDetails actor) {
		return offers.create(reportId, body.amountMinor(), body.currency(), body.technicianId(), body.note(), actor);
	}

	@PostMapping("/reports/{reportId}/job-offers/{offerId}/accept")
	public JobOfferService.OfferView accept(
			@PathVariable Long reportId,
			@PathVariable Long offerId,
			@AuthenticationPrincipal AppUserDetails actor) {
		return offers.accept(reportId, offerId, actor);
	}

	@PostMapping("/reports/{reportId}/job-offers/{offerId}/reject")
	public JobOfferService.OfferView reject(
			@PathVariable Long reportId,
			@PathVariable Long offerId,
			@RequestBody(required = false) RejectOffer body,
			@AuthenticationPrincipal AppUserDetails actor) {
		return offers.reject(reportId, offerId, body == null ? null : body.note(), actor);
	}

	@PostMapping("/reports/{reportId}/job-offers/{offerId}/counter")
	public JobOfferService.OfferView counter(
			@PathVariable Long reportId,
			@PathVariable Long offerId,
			@Valid @RequestBody CounterOffer body,
			@AuthenticationPrincipal AppUserDetails actor) {
		return offers.counter(reportId, offerId, body.amountMinor(), body.note(), actor);
	}
}
