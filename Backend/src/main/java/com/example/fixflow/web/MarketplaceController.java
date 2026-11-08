package com.example.fixflow.web;

import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.MarketplaceService;
import com.example.fixflow.service.MarketplaceService.ApplicationView;
import com.example.fixflow.service.MarketplaceService.ListingView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/marketplace/listings")
@RequiredArgsConstructor
public class MarketplaceController {
    private final MarketplaceService marketplace;

    public record Publication(@NotNull @Positive Long reportId, @NotBlank @Size(max = 300) String summary,
            @NotBlank @Size(max = 160) String broadLocation, @NotBlank @Size(max = 160) String timing) { }
    public record Application(@NotBlank @Size(max = 1000) String note) { }
    public record Selection(@NotNull Boolean safetyConfirmed) { }
    public record Cancellation(@NotBlank @Size(max = 2000) String reason) { }

    @GetMapping
    public List<ListingView> list(@AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.list(actor);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ListingView publish(@Valid @RequestBody Publication body, @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.publish(body.reportId(), body.summary(), body.broadLocation(), body.timing(), actor);
    }

    @PostMapping("/{id}/close")
    public ListingView close(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.close(id, actor);
    }

    @PostMapping("/{id}/cancel-assignment")
    public ListingView cancelAssignment(@PathVariable Long id, @Valid @RequestBody Cancellation body,
            @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.cancelAssignment(id, body.reason(), actor);
    }

    @GetMapping("/{id}/applications")
    public List<ApplicationView> applicants(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.applicants(id, actor);
    }

    @PostMapping("/{id}/applications")
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationView apply(@PathVariable Long id, @Valid @RequestBody Application body,
            @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.apply(id, body.note(), actor);
    }

    @PostMapping("/{id}/applications/{applicationId}/select")
    public ApplicationView select(@PathVariable Long id, @PathVariable Long applicationId,
            @Valid @RequestBody Selection body, @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.select(id, applicationId, body.safetyConfirmed(), actor);
    }

    @PostMapping("/{id}/applications/{applicationId}/accept")
    public ApplicationView accept(@PathVariable Long id, @PathVariable Long applicationId,
            @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.accept(id, applicationId, actor);
    }

    @PostMapping("/{id}/applications/{applicationId}/decline")
    public ApplicationView decline(@PathVariable Long id, @PathVariable Long applicationId,
            @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.leave(id, applicationId, true, actor);
    }

    @PostMapping("/{id}/applications/{applicationId}/withdraw")
    public ApplicationView withdraw(@PathVariable Long id, @PathVariable Long applicationId,
            @AuthenticationPrincipal AppUserDetails actor) {
        return marketplace.leave(id, applicationId, false, actor);
    }
}
