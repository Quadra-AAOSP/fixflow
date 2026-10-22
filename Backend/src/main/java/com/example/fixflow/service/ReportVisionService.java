package com.example.fixflow.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.multipart.MultipartFile;
import com.example.fixflow.ai.VisionProvider;
import com.example.fixflow.ai.dto.VisionClassificationRequest;
import com.example.fixflow.ai.dto.VisionClassificationResponse;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class ReportVisionService {
    public record Status(String jobId, Long reportId, String status, String model) { }
    private final ReportRepository reports;
    private final ReportVisionJobRepository jobs;
    private final SiteRuleRepository rules;
    private final ObjectProvider<VisionProvider> provider;
    private final ReportClassificationService classification;
    private final TransactionTemplate transactions;

    public ReportVisionService(ReportRepository reports, ReportVisionJobRepository jobs,
            SiteRuleRepository rules, ObjectProvider<VisionProvider> provider,
            ReportClassificationService classification, PlatformTransactionManager manager) {
        this.reports = reports; this.jobs = jobs; this.rules = rules;
        this.provider = provider; this.classification = classification;
        this.transactions = new TransactionTemplate(manager);
    }

    @Transactional
    public Status enqueue(Long reportId, MultipartFile image, boolean consent, AppUserDetails actor) {
        Report report = reports.findForVisionUpdate(reportId).orElseThrow(() -> new ApiException(404, "Report not found"));
        authorize(report, actor);
        if (!consent) throw new ApiException(400, "Explicit consent is required; do not submit faces, personal or confidential information");
        if (provider.getIfAvailable() == null) throw new ApiException(503, "Vision processing is disabled");
        if (report.getStatus() != ReportStatus.open) throw new ApiException(409, "Only open reports accept initial vision classification");
        if (jobs.existsByReportIdAndStatusIn(reportId, List.of("queued", "processing"))) {
            throw new ApiException(409, "A vision job is already pending for this report");
        }
        byte[] sanitized = sanitize(image);
        ReportVisionJob job = new ReportVisionJob();
        job.setId(UUID.randomUUID().toString()); job.setReportId(reportId); job.setImageData(sanitized);
        job.setDescription(report.getDescription()); job.setCategory(report.getCategory());
        job.setSpecialty(report.getSpecialty());
        job.setAiUrgency(report.getAiUrgency() == null ? null : report.getAiUrgency().name());
        job.setAiSnapshot(aiSnapshot(report));
        jobs.save(job);
        return status(job);
    }

    @Transactional(readOnly = true)
    public Status get(Long reportId, String jobId, AppUserDetails actor) {
        Report report = reports.findById(reportId).orElseThrow(() -> new ApiException(404, "Report not found"));
        authorize(report, actor);
        return jobs.findById(jobId).filter(j -> j.getReportId().equals(reportId)).map(this::status)
                .orElseThrow(() -> new ApiException(404, "Vision job not found"));
    }

    /** Called by a separate scheduled thread, never by the report creation request. */
    public void processPending() {
        VisionProvider vision = provider.getIfAvailable();
        if (vision == null) return;
        transactions.executeWithoutResult(tx -> jobs.recover(Instant.now().minusSeconds(600)));
        for (var candidate : jobs.findTop10ByStatusOrderByCreatedAtAsc("queued")) {
            var input = transactions.execute(tx -> {
                if (jobs.claim(candidate.getId(), Instant.now()) != 1) return null;
                ReportVisionJob job = jobs.findById(candidate.getId()).orElseThrow();
                if (job.getAttempts() > 3) {
                    job.setStatus("failed"); job.setImageData(null); return null;
                }
                Report report = reports.findById(job.getReportId()).orElseThrow();
                return VisionClassificationRequest.builder().imageData(job.getImageData()).mimeType("image/png")
                        .description(job.getDescription()).siteType(report.getSite().getType().name())
                        .allowedCategories(rules.findBySiteTypeOrderBySortOrderAsc(report.getSite().getType())
                                .stream().map(SiteRule::getCategory).toList()).build();
            });
            if (input == null) continue;
            VisionClassificationResponse result;
            try { result = vision.classifyImage(input); }
            catch (Exception unavailable) { result = null; }
            var response = result;
            transactions.executeWithoutResult(tx -> {
                Report report = reports.findForVisionUpdate(candidate.getReportId()).orElseThrow();
                ReportVisionJob job = jobs.findById(candidate.getId()).orElseThrow();
                boolean unchanged = Objects.equals(job.getAiSnapshot(), aiSnapshot(report))
                        && Objects.equals(job.getDescription(), report.getDescription())
                        && Objects.equals(job.getCategory(), report.getCategory())
                        && Objects.equals(job.getSpecialty(), report.getSpecialty())
                        && Objects.equals(job.getAiUrgency(), report.getAiUrgency() == null ? null : report.getAiUrgency().name());
                if (unchanged) {
                    classification.applyVision(report, response);
                    job.setStatus(report.getAiUrgency() == null ? "review_required" : "completed");
                } else job.setStatus("stale");
                job.setModel(response == null ? null : response.getModel());
                job.setImageData(null); job.setUpdatedAt(Instant.now());
            });
        }
    }

    private Status status(ReportVisionJob job) {
        return new Status(job.getId(), job.getReportId(), job.getStatus(), job.getModel());
    }

    private String aiSnapshot(Report report) {
        StringBuilder value = new StringBuilder();
        for (String field : new String[] {report.getAiCategory(), report.getAiSpecialty(),
                report.getAiDescription(), report.getAiUrgencyReason()}) {
            value.append(field == null ? -1 : field.length()).append(':').append(field == null ? "" : field);
        }
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    private void authorize(Report report, AppUserDetails actor) {
        if (actor == null) throw new ApiException(401, "Authentication required");
        if (actor.getRole() == UserRole.super_admin) return;
        if ((actor.getRole() == UserRole.admin || actor.getRole() == UserRole.staff)
                && report.getSite().getId().equals(actor.getSiteId())) return;
        if (actor.getRole() == UserRole.reporter && report.getCreatedBy().getId().equals(actor.getId())
                && report.getSite().getId().equals(actor.getSiteId())) return;
        throw new ApiException(403, "Not allowed to process this report image");
    }

    private byte[] sanitize(MultipartFile image) {
        if (image == null || image.isEmpty() || image.getSize() > 5 * 1024 * 1024) {
            throw new ApiException(400, "Provide one JPEG or PNG image up to 5 MiB");
        }
        try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(image.getBytes()))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw new IllegalArgumentException();
            var reader = readers.next();
            try {
                reader.setInput(stream);
                String format = reader.getFormatName();
                if (!format.equalsIgnoreCase("png") && !format.equalsIgnoreCase("jpeg")) throw new IllegalArgumentException();
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 16_000_000) {
                    throw new IllegalArgumentException();
                }
                var output = new ByteArrayOutputStream();
                ImageIO.write(reader.read(0), "png", output);
                if (output.size() > 5 * 1024 * 1024) throw new IllegalArgumentException();
                return output.toByteArray();
            } finally { reader.dispose(); }
        } catch (Exception invalid) {
            throw new ApiException(400, "Invalid or oversized JPEG/PNG image");
        }
    }
}
