package com.example.fixflow;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import com.example.fixflow.repository.*;
import com.example.fixflow.service.TechnicianTermsService;
class TechnicianTermsMandatoryTest {
 @Test void disabledConfigurationCannotBypassAcceptance() {
  var records=mock(TechnicianTermsAcceptanceRepository.class);
  var service=new TechnicianTermsService(records,mock(UserRepository.class),mock(TechnicianContractRepository.class),mock(TechnicianContractApplicationRepository.class),"v1","https://example.org/terms",false);
  assertThat(service.permitsWork(1L)).isFalse();
  when(records.existsByTechnician_IdAndTermsVersion(1L,"v1")).thenReturn(true);
  assertThat(service.permitsWork(1L)).isTrue();
 }
 @Test void missingConfigurationIsRejectedWhenRequired() {
  org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,() -> new TechnicianTermsService(mock(TechnicianTermsAcceptanceRepository.class),mock(UserRepository.class),mock(TechnicianContractRepository.class),mock(TechnicianContractApplicationRepository.class),"","",true));
 }
 @Test void unpublishedConfigurationDoesNotBlockWork() {
  var service=new TechnicianTermsService(mock(TechnicianTermsAcceptanceRepository.class),mock(UserRepository.class),mock(TechnicianContractRepository.class),mock(TechnicianContractApplicationRepository.class),"","",false);
  assertThat(service.permitsWork(1L)).isTrue();
 }
}
